// Bookings module. Step 3: names that say what things are and extracted
// functions (Rename Variable, Extract Function). The structure is still the original.
import fs from "node:fs";

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
  return new Date(isoDate + "T00:00:00Z").getUTCDay() == 6;
}

function bookingAmount(space: any, request: any): number {
  var amount = space.fee;
  if (isSaturday(request.date)) amount = amount + (amount * 20) / 100;
  if (request.guests > 50) amount = amount + 5000;
  return amount;
}

function dollars(cents: number): string {
  return Math.floor(cents / 100) + "." + String(cents % 100).padStart(2, "0");
}

export function processBookings(
  file: string,
  dir: string,
  today: Date = new Date(),
  mailer = smtp,
) {
  var data = JSON.parse(fs.readFileSync(file, "utf8"));
  var lines: string[] = [];
  for (var request of data.requests) {
    var unit = data.units.find((u: any) => u.id == request.unit);
    var space = data.spaces.find((s: any) => s.id == request.space);
    var accepted = true;
    var reason = "";
    if (unit.inArrears) {
      accepted = false;
      reason = "arrears";
    } else {
      if (daysUntil(request.date, today) < 2) {
        accepted = false;
        reason = "short notice";
      } else {
        for (var booking of approved) {
          if (booking.space == request.space && booking.date == request.date) {
            accepted = false;
            reason = "conflict";
          }
        }
      }
    }
    var head = `${request.id};${request.unit};${request.space};${request.date}`;
    if (accepted) {
      var amount = dollars(bookingAmount(space, request));
      approved.push(request);
      lines.push(`${head};approved;${amount}`);
      mailer.send(unit.email, `Booking ${request.id} confirmed. Amount: $${amount}`);
    } else {
      lines.push(`${head};declined;${reason}`);
      mailer.send(unit.email, `Booking ${request.id} declined (${reason})`);
    }
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dir + "/bookings.txt", lines.join("\n") + "\n");
  fs.writeFileSync(dir + "/emails.txt", log.join("\n") + "\n");
}

// Usage: node main.ts <input.json> <output-folder> [--today YYYY-MM-DD]
const [input, output, option, date] = process.argv.slice(2);
const today = option === "--today" ? new Date(date + "T00:00:00Z") : new Date();
processBookings(input, output, today);
