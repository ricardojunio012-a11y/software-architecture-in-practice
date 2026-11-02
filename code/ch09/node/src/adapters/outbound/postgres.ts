// PostgreSQL outbound adapter: it fulfills the same port, keeping the bookings in a
// table. It is the only file that knows SQL and the database driver.
import pg from "pg";
import { NotFoundError, Schedule, type Space } from "../../domain/schedule.ts";
import type { ScheduleRepository } from "../../application/ports.ts";

export class PostgresSchedules implements ScheduleRepository {
  readonly #db: pg.Client;
  readonly #spaces: Map<string, Space>;

  constructor(db: pg.Client, spaces: Space[]) {
    this.#db = db;
    this.#spaces = new Map(spaces.map((s) => [s.id, s]));
  }

  // Drops and recreates the table: the lab always starts from scratch
  async prepare() {
    await this.#db.query(`
      DROP TABLE IF EXISTS bookings;
      CREATE TABLE bookings (
        id text PRIMARY KEY,
        space text NOT NULL,
        unit text NOT NULL,
        date text NOT NULL,
        start_hour integer NOT NULL,
        end_hour integer NOT NULL,
        fee_cents integer NOT NULL
      )`);
  }

  async all() {
    const schedules = [];
    for (const id of this.#spaces.keys()) schedules.push(await this.forSpace(id));
    return schedules;
  }

  async forSpace(space: string) {
    const s = this.#spaces.get(space);
    if (!s) throw new NotFoundError("space not found");
    const { rows } = await this.#db.query(
      `SELECT id, unit, date, start_hour, end_hour, fee_cents FROM bookings
       WHERE space = $1 ORDER BY date, start_hour`,
      [space],
    );
    const bookings = rows.map((r) => ({
      id: r.id,
      unit: r.unit,
      date: r.date,
      start: r.start_hour,
      end: r.end_hour,
      feeCents: r.fee_cents,
    }));
    return new Schedule(s, bookings);
  }

  async forBooking(booking: string) {
    const { rows } = await this.#db.query("SELECT space FROM bookings WHERE id = $1", [
      booking,
    ]);
    if (rows.length === 0) throw new NotFoundError("booking not found");
    return this.forSpace(rows[0].space);
  }

  // Writes the schedule in one transaction: the aggregate is the unit of consistency
  async save(schedule: Schedule) {
    await this.#db.query("BEGIN");
    try {
      await this.#db.query("DELETE FROM bookings WHERE space = $1", [
        schedule.space.id,
      ]);
      for (const b of schedule.bookings()) {
        await this.#db.query(
          "INSERT INTO bookings VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [b.id, schedule.space.id, b.unit, b.date, b.start, b.end, b.feeCents],
        );
      }
      await this.#db.query("COMMIT");
    } catch (error) {
      await this.#db.query("ROLLBACK");
      throw error;
    }
  }
}
