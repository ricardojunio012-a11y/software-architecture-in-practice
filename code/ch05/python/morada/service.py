# Receives the request, consults the approval chain, stores and announces the result.
from morada.approval import Stage
from morada.events import Event, EventBus
from morada.repository import BookingRepository
from morada.state import Booking
from morada.types import BookingRequest, Decision


class BookingService:
    def __init__(self, approval: Stage, bookings: BookingRepository, events: EventBus):
        self._approval = approval
        self._bookings = bookings
        self._events = events

    def submit(self, request: BookingRequest) -> Decision:
        booking = Booking(request)
        decision = self._approval.evaluate(request)
        # The chain saw the space free, but another request may have saved since:
        # saving checks again, in a single operation (step 6 of the lab)
        if decision.approved and not self._bookings.save_if_free(booking):
            decision = Decision(False, "space already booked on this date")
        if decision.approved:
            booking.approve()
            self._events.publish(Event("BookingConfirmed", request))
        else:
            booking.reject()
            self._bookings.save(booking)
            self._events.publish(Event("BookingRejected", request, decision.reason))
        return decision

    def cancel(self, id: str) -> str:
        """The state decides whether the booking can be canceled."""
        booking = self._bookings.find(id)
        if booking is None:
            raise ValueError(f"booking {id} not found")
        before = booking.state
        booking.cancel()
        return f"{before} -> {booking.state}"
