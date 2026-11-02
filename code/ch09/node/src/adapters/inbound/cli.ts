// Command-line inbound adapter: the same use cases, driven by arguments and answered
// in text for a person to read at the terminal.
import type { BookingUseCases } from "../../application/ports.ts";

const BOOK_USAGE = "usage: book <booking> <unit> <space> <date> <start> <end> <today>";

// Returns the text to show and the process exit code (0 = success)
export async function execute(
  bookings: BookingUseCases,
  args: string[],
): Promise<[string, number]> {
  const [command, ...rest] = args;
  try {
    switch (command) {
      case "spaces": {
        const spaces = await bookings.listSpaces();
        const lines = spaces.map((s) => {
          const days = `${s.minNoticeDays} day(s)`;
          return `${s.id}: fee ${s.fee}, notice of ${days}`;
        });
        return [lines.join("\n"), 0];
      }
      case "book": {
        if (rest.length !== 7) return [BOOK_USAGE, 2];
        const [booking, unit, space, date, start, end, requestedOn] = rest;
        const c = await bookings.book({
          booking,
          unit,
          space,
          date,
          start: Number(start),
          end: Number(end),
          requestedOn,
        });
        return [`${c.booking} confirmed, fee ${c.fee}`, 0];
      }
      case "cancel": {
        const c = await bookings.cancel(rest[0], rest[1]);
        return [`${c.booking} canceled, cancellation fee ${c.cancellationFee}`, 0];
      }
      case "bookings": {
        const list = await bookings.bookingsForSpace(rest[0]);
        if (list.length === 0) return ["no bookings", 0];
        return [list.map((b) => `${b.booking} ${b.unit} ${b.slot}`).join("\n"), 0];
      }
      default:
        return ["commands: spaces, book, cancel, bookings", 2];
    }
  } catch (error) {
    return [`error: ${(error as Error).message}`, 1];
  }
}
