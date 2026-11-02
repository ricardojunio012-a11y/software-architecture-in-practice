# Command-line inbound adapter: the same use cases, driven by arguments and answered
# in text for a person to read at the terminal.
from morada.application.ports import BookingUseCases

BOOK_USAGE = "usage: book <booking> <unit> <space> <date> <start> <end> <today>"


# Returns the text to show and the process exit code (0 = success)
def execute(bookings: BookingUseCases, args: list[str]) -> tuple[str, int]:
    command, rest = (args[0], args[1:]) if args else ("", [])
    try:
        if command == "spaces":
            lines = [
                f"{s['id']}: fee {s['fee']}, notice of {s['minNoticeDays']} day(s)"
                for s in bookings.list_spaces()
            ]
            return "\n".join(lines), 0
        if command == "book":
            if len(rest) != 7:
                return BOOK_USAGE, 2
            booking, unit, space, date, start, end, requested_on = rest
            c = bookings.book(
                {
                    "booking": booking,
                    "unit": unit,
                    "space": space,
                    "date": date,
                    "start": int(start),
                    "end": int(end),
                    "requestedOn": requested_on,
                }
            )
            return f"{c['booking']} confirmed, fee {c['fee']}", 0
        if command == "cancel":
            c = bookings.cancel(rest[0], rest[1])
            return (
                f"{c['booking']} canceled, cancellation fee {c['cancellationFee']}",
                0,
            )
        if command == "bookings":
            found = bookings.bookings_for_space(rest[0])
            if not found:
                return "no bookings", 0
            return (
                "\n".join(f"{b['booking']} {b['unit']} {b['slot']}" for b in found),
                0,
            )
        return "commands: spaces, book, cancel, bookings", 2
    except Exception as error:
        return f"error: {error}", 1
