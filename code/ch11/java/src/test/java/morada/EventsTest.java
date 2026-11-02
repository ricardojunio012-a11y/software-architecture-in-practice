// Tests: the subscribers are idempotent and independent of each other.
package morada;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import morada.Events.Payment;
import morada.modules.Bookings;
import morada.modules.Bookings.Booking;
import morada.modules.Communications;
import org.junit.jupiter.api.Test;

class EventsTest {

    static final Events.PaymentConfirmed EVENT = Events.eventFor(
        new Payment("P-1", "A-1", "R-1", 18000, null)
    );

    @Test
    void confirmTheBookingAndNotifyTheResident() {
        var bookings = new Bookings(
            List.of(new Booking("R-1", "A-1", "party-room", "2026-03-14"))
        );
        var communications = new Communications();
        bookings.onPaymentConfirmed(EVENT);
        communications.onPaymentConfirmed(EVENT);
        assertEquals(
            List.of("R-1;A-1;party-room;2026-03-14;confirmed"),
            bookings.lines()
        );
        assertEquals(1, communications.notices.size());
    }

    @Test
    void ignoreTheSameEventDeliveredTwice() {
        var communications = new Communications();
        communications.onPaymentConfirmed(EVENT);
        communications.onPaymentConfirmed(EVENT);
        assertEquals(1, communications.notices.size());
        assertEquals(
            "communications ignored E-P-1 (duplicate)",
            communications.log.get(1)
        );
    }
}
