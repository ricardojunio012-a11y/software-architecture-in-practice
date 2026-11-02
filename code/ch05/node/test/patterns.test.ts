// Tests: each pattern in isolation, with test doubles in place of the providers.
import { describe, expect, it } from "vitest";
import { MinimumNotice, UnitInGoodStanding } from "../src/approval.ts";
import { EventBus, type Event } from "../src/events.ts";
import {
  ChannelFactory,
  Email,
  SimulatedProvider,
  Sms,
  WithLogging,
  WithRetries,
} from "../src/notification.ts";
import { InMemoryRepository } from "../src/repository.ts";
import { Booking } from "../src/state.ts";
import type { BookingRequest, Resident } from "../src/types.ts";

const resident: Resident = {
  name: "David",
  email: "d@x.com",
  phone: "+1",
  channel: "sms",
};
const space = {
  id: "party-room",
  name: "Party room",
  feeCents: 15000,
  minNoticeDays: 2,
  monthlyLimit: 1,
};
const request: BookingRequest = {
  id: "R-1",
  unit: { id: "A-1", inArrears: false, resident },
  space,
  date: "2026-03-03",
};
const message = { title: "Test", text: "hello" };

describe("Decorator", () => {
  it("retries outside and logging inside: every attempt is logged", () => {
    const provider = new SimulatedProvider({ "+1": 2 });
    const log: string[] = [];
    const waits: number[] = [];
    const withLogging = new WithLogging(new Sms(provider), log);
    const channel = new WithRetries(withLogging, 3, (ms) => waits.push(ms));
    channel.send(resident, message);
    expect(log).toEqual([
      "sms to David: failed (provider unavailable)",
      "sms to David: failed (provider unavailable)",
      "sms to David: delivered (Test)",
    ]);
    expect(waits).toEqual([100, 200]); // growing wait
  });

  it("a permanent failure is not retried", () => {
    const provider = new SimulatedProvider({}, ["d@x.com"]);
    const log: string[] = [];
    const withLogging = new WithLogging(new Email(provider), log);
    const channel = new WithRetries(withLogging, 3, () => {});
    expect(() => channel.send(resident, message)).toThrow("without retry");
    expect(log).toHaveLength(1);
  });
});

describe("State", () => {
  it("the booking accepts only the transitions of its current state", () => {
    const booking = new Booking(request);
    booking.approve();
    booking.cancel();
    expect(booking.state).toBe("canceled");
    expect(() => booking.approve()).toThrow("cannot approve a canceled booking");
  });
});

describe("Repository", () => {
  it("saveIfFree rejects the second request for the same space and date", () => {
    const bookings = new InMemoryRepository();
    const first = new Booking(request);
    expect(bookings.saveIfFree(first)).toBe(true);
    first.approve();
    expect(bookings.saveIfFree(new Booking({ ...request, id: "R-2" }))).toBe(false);
  });
});

describe("Factory", () => {
  it("picks the channel by preference and falls back to email if unknown", () => {
    const factory = new ChannelFactory(new SimulatedProvider({}), [], () => {});
    expect(factory.forResident(resident).name).toBe("sms");
    const pigeon = { ...resident, channel: "carrier-pigeon" };
    expect(factory.forResident(pigeon).name).toBe("email");
  });
});

describe("Chain of Responsibility", () => {
  it("the first stage that rejects decides the reason", () => {
    const chain = new UnitInGoodStanding();
    chain.andThen(new MinimumNotice(new Date("2026-03-02T00:00:00Z")));
    const inArrears = { ...request, unit: { ...request.unit, inArrears: true } };
    expect(chain.evaluate(inArrears).reason).toBe("unit in arrears");
    expect(chain.evaluate(request).reason).toBe("minimum notice of 2 days");
    expect(chain.evaluate({ ...request, date: "2026-03-10" })).toEqual({
      approved: true,
    });
  });
});

describe("Observer", () => {
  it("a subscriber that fails does not stop the others", () => {
    const events = new EventBus();
    const received: string[] = [];
    events.subscribe("BookingConfirmed", {
      name: "Broken",
      handle: () => {
        throw new Error("out of service");
      },
    });
    events.subscribe("BookingConfirmed", {
      name: "FrontDesk",
      handle: (e: Event) => received.push(e.request.id),
    });
    events.publish({ type: "BookingConfirmed", request });
    expect(received).toEqual(["R-1"]);
    expect(events.failures).toEqual(["BookingConfirmed R-1: Broken: out of service"]);
  });
});
