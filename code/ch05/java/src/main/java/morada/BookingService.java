// Receives the request, consults the approval chain, stores and announces the result.
package morada;

import morada.Approval.Stage;
import morada.Events.Event;
import morada.Events.EventBus;
import morada.Repository.BookingRepository;
import morada.State.Booking;
import morada.Types.BookingRequest;
import morada.Types.Decision;

public class BookingService {

    private final Stage approval;
    private final BookingRepository bookings;
    private final EventBus events;

    public BookingService(Stage approval, BookingRepository bookings, EventBus events) {
        this.approval = approval;
        this.bookings = bookings;
        this.events = events;
    }

    public Decision submit(BookingRequest request) {
        var booking = new Booking(request);
        Decision decision = approval.evaluate(request);
        // The chain saw the space free, but another request may have saved since:
        // saving checks again, in a single operation (step 6 of the lab)
        if (decision.approved() && !bookings.saveIfFree(booking)) {
            decision = new Decision(false, "space already booked on this date");
        }
        if (decision.approved()) {
            booking.approve();
            events.publish(new Event("BookingConfirmed", request, null));
        } else {
            booking.reject();
            bookings.save(booking);
            events.publish(new Event("BookingRejected", request, decision.reason()));
        }
        return decision;
    }

    // The state decides whether the booking can be canceled
    public String cancel(String id) {
        var booking = bookings
            .find(id)
            .orElseThrow(() ->
                new IllegalStateException("booking " + id + " not found")
            );
        String before = booking.state();
        booking.cancel();
        return before + " -> " + booking.state();
    }
}
