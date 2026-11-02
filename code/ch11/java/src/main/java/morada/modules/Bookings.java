// Bookings subscribes to PaymentConfirmed: the booking awaiting payment is confirmed.
// The subscriber is idempotent, because the broker delivers "at least once".
package morada.modules;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import morada.Events.PaymentConfirmed;

public class Bookings {

    public record Booking(String booking, String unit, String space, String date) {}

    private final Map<String, Booking> bookings = new LinkedHashMap<>();
    private final Map<String, String> status = new LinkedHashMap<>();
    private final Set<String> processed = new HashSet<>();
    public final List<String> log = new ArrayList<>();

    public Bookings(List<Booking> initial) {
        for (Booking b : initial) {
            bookings.put(b.booking(), b);
            status.put(b.booking(), "awaiting payment");
        }
    }

    public void onPaymentConfirmed(PaymentConfirmed e) {
        if (!processed.add(e.event())) {
            log.add("bookings ignored " + e.event() + " (duplicate)");
            return;
        }
        status.put(e.booking(), "confirmed");
        log.add("bookings received " + e.event() + ": " + e.booking() + " confirmed");
    }

    public List<String> lines() {
        return bookings
            .values()
            .stream()
            .map(b ->
                String.join(
                    ";",
                    b.booking(),
                    b.unit(),
                    b.space(),
                    b.date(),
                    status.get(b.booking())
                )
            )
            .toList();
    }
}
