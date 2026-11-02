// "Now the hard part": two requests for the same space and the same date
// arrive at the same time. The interleaving is forced, so the output is always
// the same: both go through the chain before either one saves.
package morada;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;
import morada.Approval.Stage;
import morada.Repository.BookingRepository;
import morada.State.Booking;
import morada.Types.BookingRequest;

public final class Race {

    private Race() {}

    public record Assembly(Stage chain, BookingRepository bookings) {}

    public static List<String> race(
        List<BookingRequest> requests,
        Supplier<Assembly> build
    ) {
        BookingRequest first = requests.get(0);
        List<String> lines = new ArrayList<>();
        String when = first.space().name() + " on " + Types.usDate(first.date());
        lines.add("Simultaneous requests: " + when);
        for (boolean guarded : new boolean[] { false, true }) {
            lines.add(
                guarded
                    ? "save only if the space is free, in a single operation:"
                    : "check, then save (check-then-act):"
            );
            Assembly a = build.get();
            // 1. Both check: the space is free for both
            List<BookingRequest> approved = new ArrayList<>();
            for (BookingRequest r : requests) {
                var d = a.chain().evaluate(r);
                String text = d.approved() ? "passed the chain" : d.reason();
                lines.add("  " + r.id() + " " + r.unit().id() + ": " + text);
                if (d.approved()) approved.add(r);
            }
            // 2. Both save
            for (BookingRequest r : approved) {
                var booking = new Booking(r);
                boolean saved = guarded ? a.bookings().saveIfFree(booking) : true;
                if (!guarded) a.bookings().save(booking);
                if (saved) booking.approve();
                lines.add("  " + r.id() + " " + (saved ? "saved" : "rejected on save"));
            }
            long n = requests
                .stream()
                .filter(r ->
                    a
                        .bookings()
                        .find(r.id())
                        .map(b -> b.state().equals("approved"))
                        .orElse(false)
                )
                .count();
            String result = n == 1 ? "1 booking approved" : n + " bookings approved";
            String twice = n > 1 ? " (double booking)" : "";
            lines.add("  result: " + result + twice);
        }
        return lines;
    }
}
