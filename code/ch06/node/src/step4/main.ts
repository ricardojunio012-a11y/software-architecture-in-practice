// Bookings module. Step 4: conditionals and magic numbers (Replace Nested
// Conditional with Guard Clauses, Replace Magic Literal, Replace Loop with Pipeline).
import fs from "node:fs";

const MIN_NOTICE_DAYS = 2;
const SATURDAY_SURCHARGE_PERCENT = 20;
const GUEST_LIMIT = 50;
const EXTRA_CLEANING_FEE = 5000; // cents

var approved: any[] = [];
var log: string[] = [];

var smtp = {
  send(to: string, text: string) {
    log.push("to " + to + ": " + text);
  },
};

function daysUntil(isoDate: string, today: Date): number {
  const startOfToday = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  return Math.round((Date.parse(isoDate + "T00:00:00Z") - startOfToday) / 86400000);
}

// The original comment said "weekend", but the code only checks Saturday
function isSaturday(isoDate: string): boolean {
  return new Date(isoDate + "T00:00:00Z").getUTCDay() === 6;
}

function bookingAmount(space: any, request: any): number {
  let amount = space.fee;
  if (isSaturday(request.date)) amount += (amount * SATURDAY_SURCHARGE_PERCENT) / 100;
  if (request.guests > GUEST_LIMIT) amount += EXTRA_CLEANING_FEE;
  return amount;
}

function dollars(cents: number): string {
  return Math.floor(cents / 100) + "." + String(cents % 100).padStart(2, "0");
}

// Guard clauses: the first rule that fails returns the reason
function declineReason(request: any, unit: any, today: Date): string | null {
  if (unit.inArrears) return "arrears";
  if (daysUntil(request.date, today) < MIN_NOTICE_DAYS) return "short notice";
  const taken = approved.some(
    (b) => b.space === request.space && b.date === request.date,
  );
  if (taken) return "conflict";
  return null;
}

export function processBookings(
  file: string,
  dir: string,
  today: Date = new Date(),
  mailer = smtp,
) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const lines: string[] = [];
  for (const request of data.requests) {
    const unit = data.units.find((u: any) => u.id === request.unit);
    const space = data.spaces.find((s: any) => s.id === request.space);
    const reason = declineReason(request, unit, today);
    const head = `${request.id};${request.unit};${request.space};${request.date}`;
    if (reason) {
      lines.push(`${head};declined;${reason}`);
      mailer.send(unit.email, `Booking ${request.id} declined (${reason})`);
      continue;
    }
    const amount = dollars(bookingAmount(space, request));
    approved.push(request);
    lines.push(`${head};approved;${amount}`);
    mailer.send(unit.email, `Booking ${request.id} confirmed. Amount: $${amount}`);
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dir + "/bookings.txt", lines.join("\n") + "\n");
  fs.writeFileSync(dir + "/emails.txt", log.join("\n") + "\n");
}

// Usage: node main.ts <input.json> <output-folder> [--today YYYY-MM-DD]
const [input, output, option, date] = process.argv.slice(2);
const today = option === "--today" ? new Date(date + "T00:00:00Z") : new Date();
processBookings(input, output, today);
