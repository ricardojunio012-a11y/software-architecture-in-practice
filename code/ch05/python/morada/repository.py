# Repository: whoever uses the bookings does not know where they are stored.
from typing import Protocol

from morada.state import Booking


class BookingRepository(Protocol):
    def save(self, booking: Booking) -> None: ...

    # Checks and saves in a single operation: in the database, a uniqueness constraint
    def save_if_free(self, booking: Booking) -> bool: ...

    def find(self, id: str) -> Booking | None: ...

    def is_taken(self, space: str, date: str) -> bool: ...

    def count_in_month(self, unit: str, space: str, month: str) -> int: ...


class InMemoryRepository:
    """In memory for the lab; chapter 16 replaces it with a database.
    Keeps every booking; the queries count only the approved ones."""

    def __init__(self):
        self._bookings: list[Booking] = []

    def save(self, booking: Booking) -> None:
        self._bookings.append(booking)

    def save_if_free(self, booking: Booking) -> bool:
        if self.is_taken(booking.request.space.id, booking.request.date):
            return False
        self.save(booking)
        return True

    def find(self, id: str) -> Booking | None:
        return next((b for b in self._bookings if b.request.id == id), None)

    def is_taken(self, space: str, date: str) -> bool:
        return any(r.space.id == space and r.date == date for r in self._approved())

    def count_in_month(self, unit: str, space: str, month: str) -> int:
        return sum(
            1
            for r in self._approved()
            if r.unit.id == unit and r.space.id == space and r.date.startswith(month)
        )

    def _approved(self):
        return [b.request for b in self._bookings if b.state == "approved"]
