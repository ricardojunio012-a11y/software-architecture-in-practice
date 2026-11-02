# The center of the hexagon: the booking rules. Imports nothing outside the domain.
from dataclasses import dataclass
from datetime import date


class RuleViolatedError(Exception):
    pass


class NotFoundError(Exception):
    pass


# $1,234.56
def dollars(cents: int) -> str:
    return f"${cents // 100:,}.{cents % 100:02d}"


@dataclass(frozen=True)
class Space:
    id: str
    fee_cents: int
    min_notice_days: int


@dataclass(frozen=True)
class Booking:
    id: str
    unit: str
    date: str
    start: int
    end: int
    fee_cents: int


# 2026-03-14 14:00-22:00
def slot(b: Booking) -> str:
    return f"{b.date} {b.start:02d}:00-{b.end:02d}:00"


def days(start: str, end: str) -> int:
    return (date.fromisoformat(end) - date.fromisoformat(start)).days


class Schedule:
    # A repository that loads a saved schedule passes in the existing bookings
    def __init__(self, space: Space, bookings: list[Booking] | None = None):
        self.space = space
        self._bookings = list(bookings or [])

    def book(self, id, unit, date_, start, end, today) -> Booking:
        if end <= start:
            raise RuleViolatedError("invalid time slot")
        if days(today, date_) < self.space.min_notice_days:
            raise RuleViolatedError("minimum notice not met")
        for b in self._bookings:
            if b.date == date_ and b.start < end and start < b.end:
                raise RuleViolatedError(f"time slot overlaps {b.id}")
        base = self.space.fee_cents
        weekend = date.fromisoformat(date_).weekday() >= 5
        fee = base + (base * 20 + 50) // 100 if weekend else base
        booking = Booking(id, unit, date_, start, end, fee)
        self._bookings.append(booking)
        return booking

    # Returns the cancellation fee in cents: 50% of the fee if less than 2 days remain
    def cancel(self, id: str, today: str) -> int:
        for i, b in enumerate(self._bookings):
            if b.id == id:
                del self._bookings[i]
                if days(today, b.date) < 2:
                    return (b.fee_cents * 50 + 50) // 100
                return 0
        raise NotFoundError("booking not found")

    # In date and time order, whatever the order in which they were stored
    def bookings(self) -> list[Booking]:
        return sorted(self._bookings, key=lambda b: (b.date, b.start))
