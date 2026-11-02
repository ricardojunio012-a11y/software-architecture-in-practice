// Characterization tests: they describe what the code does today, including what
// may be wrong. Changing the behavior is another step, with another commit.
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  bookingAmount,
  decide,
  declineReason,
  notices,
  report,
} from "../src/step5/bookings.ts";

// Input and approved result: /data in the container; outside it, the chapter folder
const folder = (name: string) =>
  fs.existsSync(`/data/${name}`)
    ? `/data/${name}`
    : `${import.meta.dirname}/../../${name}`;
const read = (name: string, file: string) =>
  fs.readFileSync(`${folder(name)}/${file}`, "utf8");
const today = new Date("2026-03-02T00:00:00Z");
const partyRoom = { id: "party-room", name: "Party room", fee: 15000 };

describe("characterization", () => {
  it("the output is identical to the approved result (golden master)", () => {
    const decisions = decide(JSON.parse(read("input", "bookings.json")), today);
    const emails = notices(decisions).map((n) => `to ${n.to}: ${n.text}`);
    expect(report(decisions).join("\n") + "\n").toBe(read("expected", "bookings.txt"));
    expect(emails.join("\n") + "\n").toBe(read("expected", "emails.txt"));
  });

  it("Sunday has no weekend surcharge (current behavior)", () => {
    const sunday = {
      id: "R",
      unit: "A",
      space: "party-room",
      date: "2026-03-15",
      guests: 1,
    };
    const saturday = { ...sunday, date: "2026-03-14" };
    expect(bookingAmount(partyRoom, sunday)).toBe(15000);
    expect(bookingAmount(partyRoom, saturday)).toBe(18000);
  });

  it("the first rule that fails decides the reason", () => {
    const request = {
      id: "R",
      unit: "A",
      space: "party-room",
      date: "2026-03-03",
      guests: 1,
    };
    const inArrears = { id: "A", email: "a@x.com", inArrears: true };
    expect(declineReason(request, inArrears, today, [])).toBe("arrears");
    expect(declineReason(request, { ...inArrears, inArrears: false }, today, [])).toBe(
      "short notice",
    );
  });
});
