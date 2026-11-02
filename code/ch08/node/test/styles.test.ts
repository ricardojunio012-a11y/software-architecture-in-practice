// Tests: each layer can be tested without the ones above it; the core, without real
// plugins.
import { describe, expect, it } from "vitest";
import { BookingService } from "../src/layers/application/booking-service.ts";
import { createApi } from "../src/layers/presentation/api.ts";
import { ScheduleRepository } from "../src/layers/data/repository.ts";
import { Schedule, RuleViolationError } from "../src/layers/domain/domain.ts";
import { Core } from "../src/plugins/core.ts";

const partyRoom = { id: "party-room", feeCents: 15000, minNoticeDays: 2 };

describe("layers", () => {
  it("the domain rejects an overlapping time slot without knowing HTTP exists", () => {
    const schedule = new Schedule(partyRoom);
    schedule.book("R-1", "A-101", "2026-03-14", 14, 22, "2026-03-02");
    expect(() =>
      schedule.book("R-2", "A-202", "2026-03-14", 20, 23, "2026-03-02"),
    ).toThrow(RuleViolationError);
  });

  it("the presentation layer turns the violated rule into a 409", async () => {
    const api = createApi(new BookingService(new ScheduleRepository([partyRoom])));
    const body = {
      booking: "R-1",
      unit: "A-101",
      space: "party-room",
      date: "2026-03-03",
      start: 10,
      end: 12,
      requestedOn: "2026-03-02",
    };
    const response = await api.inject({
      method: "POST",
      url: "/bookings",
      payload: body,
    });
    expect(response.statusCode).toBe(409);
  });
});

describe("microkernel", () => {
  it("issues through the installed plugin and reports a missing plugin", () => {
    const core = new Core();
    core.install({ name: "test", register: (c) => `T-${c.unit}` });
    expect(core.issue({ unit: "A-1", amountCents: 100, bank: "test" })).toBe(
      "A-1;$1.00;test;T-A-1",
    );
    expect(core.issue({ unit: "A-1", amountCents: 100, bank: "zeta" })).toBe(
      "A-1;$1.00;zeta;no plugin for bank zeta",
    );
  });

  it("a faulty plugin does not bring down the core", () => {
    const core = new Core();
    core.install({
      name: "broken",
      register: () => {
        throw new Error("out of service");
      },
    });
    expect(core.issue({ unit: "A-1", amountCents: 100, bank: "broken" })).toBe(
      "A-1;$1.00;broken;plugin broken failed: out of service",
    );
  });

  it("rejects a plugin that does not fulfill the contract", () => {
    const core = new Core();
    expect(() => core.install({ name: "x" } as never)).toThrow("contract");
  });
});
