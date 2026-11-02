# State: what you can do with a booking depends on the state it is in.
# Each state is an object that knows which transitions it accepts; the booking
# only passes the call on.
from morada.types import BookingRequest


class State:
    name = ""

    # By default, no transition is allowed; each state allows its own
    def approve(self, booking: "Booking") -> None:
        self._reject_transition("approve")

    def reject(self, booking: "Booking") -> None:
        self._reject_transition("reject")

    def cancel(self, booking: "Booking") -> None:
        self._reject_transition("cancel")

    def _reject_transition(self, action: str):
        raise ValueError(f"cannot {action} a {self.name} booking")


class Pending(State):
    name = "pending"

    def approve(self, booking):
        booking.change_to(APPROVED)

    def reject(self, booking):
        booking.change_to(REJECTED)

    def cancel(self, booking):
        booking.change_to(CANCELED)


class Approved(State):
    name = "approved"

    def cancel(self, booking):
        booking.change_to(CANCELED)


class Rejected(State):
    name = "rejected"


class Canceled(State):
    name = "canceled"


# The states hold no data of their own: one instance of each is enough
APPROVED = Approved()
REJECTED = Rejected()
CANCELED = Canceled()


class Booking:
    def __init__(self, request: BookingRequest):
        self.request = request
        self._state: State = Pending()

    @property
    def state(self) -> str:
        return self._state.name

    def approve(self) -> None:
        self._state.approve(self)

    def reject(self) -> None:
        self._state.reject(self)

    def cancel(self) -> None:
        self._state.cancel(self)

    def change_to(self, state: State) -> None:
        """Used only by the states."""
        self._state = state
