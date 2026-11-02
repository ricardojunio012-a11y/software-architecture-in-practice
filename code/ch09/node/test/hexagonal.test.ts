// Tests: the core with no real adapter, the adapters with no real core, and the
// same contract checked against both repositories.
import pg from "pg";
import { describe, expect, it } from "vitest";
import { execute } from "../src/adapters/inbound/cli.ts";
import { InMemorySchedules } from "../src/adapters/outbound/in-memory.ts";
import { PostgresSchedules } from "../src/adapters/outbound/postgres.ts";
import type { BookingUseCases, ScheduleRepository } from "../src/application/ports.ts";
import { BookingService } from "../src/application/booking-service.ts";

const partyRoom = { id: "party-room", feeCents: 15000, minNoticeDays: 2 };
const request = {
  booking: "R-1",
  unit: "A-101",
  space: "party-room",
  date: "2026-03-14",
  start: 14,
  end: 22,
  requestedOn: "2026-03-02",
};

describe("core", () => {
  it("books and rejects an overlap with only the in-memory repository", async () => {
    const service = new BookingService(new InMemorySchedules([partyRoom]));
    expect((await service.book(request)).fee).toBe("$180.00");
    await expect(service.book({ ...request, booking: "R-2" })).rejects.toThrow(
      "time slot overlaps R-1",
    );
  });
});

describe("command-line adapter", () => {
  it("translates arguments into calls, with no need for the real core", async () => {
    const calls: string[] = [];
    const fake = {
      cancel: async (booking: string, requestedOn: string) => {
        calls.push(`${booking} ${requestedOn}`);
        return { booking, status: "canceled" as const, cancellationFee: "$0.00" };
      },
    } as BookingUseCases;
    const [text, code] = await execute(fake, ["cancel", "R-7", "2026-03-01"]);
    expect(calls).toEqual(["R-7 2026-03-01"]);
    expect([text, code]).toEqual(["R-7 canceled, cancellation fee $0.00", 0]);
  });

  it("shows the usage when arguments are missing", async () => {
    const [text, code] = await execute({} as BookingUseCases, ["book"]);
    expect(text).toMatch(/^usage: book/);
    expect(code).toBe(2);
  });
});

// The same contract holds for any adapter of the outbound port
function contract(name: string, create: () => Promise<ScheduleRepository>) {
  describe(`repository contract: ${name}`, () => {
    it("keeps the schedule and finds it by booking", async () => {
      const schedules = await create();
      const schedule = await schedules.forSpace("party-room");
      schedule.book("R-1", "A-101", "2026-03-14", 14, 22, "2026-03-02");
      await schedules.save(schedule);
      const returned = await schedules.forBooking("R-1");
      expect(returned.bookings().map((b) => b.id)).toEqual(["R-1"]);
    });

    it("reports when the space or the booking does not exist", async () => {
      const schedules = await create();
      await expect(schedules.forSpace("pool")).rejects.toThrow("space not found");
      await expect(schedules.forBooking("R-9")).rejects.toThrow("booking not found");
    });
  });
}

contract("in memory", async () => new InMemorySchedules([partyRoom]));

// In the container, the database exists; outside it, the PostgreSQL test is skipped
const url = process.env.DATABASE_URL;
describe.skipIf(!url)("postgres", () => {
  contract("PostgreSQL", async () => {
    const db = new pg.Client({ connectionString: url });
    await db.connect();
    const schedules = new PostgresSchedules(db, [partyRoom]);
    await schedules.prepare();
    return schedules;
  });
});
