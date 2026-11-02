// Composition root: the only place that picks the adapters and wires them to the core.
import fs from "node:fs";
import pg from "pg";
import { BookingService } from "../application/booking-service.ts";
import { InMemorySchedules } from "../adapters/outbound/in-memory.ts";
import { PostgresSchedules } from "../adapters/outbound/postgres.ts";

export async function assemble(repository: string, prepare = false) {
  const { spaces } = JSON.parse(fs.readFileSync("/data/input/spaces.json", "utf8"));
  if (repository === "memory") {
    const schedules = new InMemorySchedules(spaces);
    return { service: new BookingService(schedules), schedules, close: async () => {} };
  }
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const schedules = new PostgresSchedules(db, spaces);
  if (prepare) await schedules.prepare();
  return {
    service: new BookingService(schedules),
    schedules,
    close: () => db.end(),
  };
}
