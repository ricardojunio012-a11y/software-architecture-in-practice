// Command-line inbound adapter: the same use cases, driven by arguments and answered
// in text for a person to read at the terminal.
package morada.adapters.inbound;

import java.util.Arrays;
import java.util.stream.Collectors;
import morada.application.BookingUseCases;
import morada.application.BookingUseCases.BookingRequest;

public class Cli {

    // The text to show and the process exit code (0 = success)
    public record Result(String text, int code) {}

    static final String BOOK_USAGE =
        "usage: book <booking> <unit> <space> <date> <start> <end> <today>";

    public static Result execute(BookingUseCases bookings, String[] args) {
        String command = args.length > 0 ? args[0] : "";
        String[] rest = Arrays.copyOfRange(args, Math.min(1, args.length), args.length);
        try {
            switch (command) {
                case "spaces" -> {
                    String lines = bookings
                        .listSpaces()
                        .stream()
                        .map(s -> {
                            String days = s.minNoticeDays() + " day(s)";
                            return s.id() + ": fee " + s.fee() + ", notice of " + days;
                        })
                        .collect(Collectors.joining("\n"));
                    return new Result(lines, 0);
                }
                case "book" -> {
                    if (rest.length != 7) return new Result(BOOK_USAGE, 2);
                    var c = bookings.book(
                        new BookingRequest(
                            rest[0],
                            rest[1],
                            rest[2],
                            rest[3],
                            Integer.parseInt(rest[4]),
                            Integer.parseInt(rest[5]),
                            rest[6]
                        )
                    );
                    return new Result(c.booking() + " confirmed, fee " + c.fee(), 0);
                }
                case "cancel" -> {
                    var c = bookings.cancel(rest[0], rest[1]);
                    String fee = c.cancellationFee();
                    return new Result(
                        c.booking() + " canceled, cancellation fee " + fee,
                        0
                    );
                }
                case "bookings" -> {
                    var list = bookings.bookingsForSpace(rest[0]);
                    if (list.isEmpty()) return new Result("no bookings", 0);
                    String lines = list
                        .stream()
                        .map(b -> b.booking() + " " + b.unit() + " " + b.slot())
                        .collect(Collectors.joining("\n"));
                    return new Result(lines, 0);
                }
                default -> {
                    return new Result("commands: spaces, book, cancel, bookings", 2);
                }
            }
        } catch (RuntimeException error) {
            return new Result("error: " + error.getMessage(), 1);
        }
    }
}
