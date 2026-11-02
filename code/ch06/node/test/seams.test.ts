// The step 2 seams at work: with a fixed date and a fake mailer, the old module runs
// inside a test, without depending on the clock and without sending any email.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { processBookings } from "../src/step2/main.ts";

const input = fs.existsSync("/data/input")
  ? "/data/input"
  : `${import.meta.dirname}/../../input`;

// The fake mailer: instead of sending, it keeps each message in a list
class FakeMailer {
  readonly sent: string[] = [];

  send(to: string, text: string) {
    this.sent.push(`${to}: ${text}`);
  }
}

describe("step 2: seams", () => {
  it("runs with a fixed date and a fake mailer", () => {
    const mailer = new FakeMailer();
    const output = fs.mkdtempSync(path.join(os.tmpdir(), "step2-"));
    const today = new Date("2026-03-02T00:00:00Z");
    processBookings(path.join(input, "bookings.json"), output, today, mailer);
    expect(mailer.sent).toHaveLength(8);
    expect(mailer.sent[0]).toBe(
      "anna.scott@example.com: Booking R-01 confirmed. Amount: $180.00",
    );
  });
});
