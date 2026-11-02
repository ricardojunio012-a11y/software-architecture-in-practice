# Domain layer: the booking rules. It knows nothing about HTTP, JSON or databases.
from dataclasses import dataclass
from datetime import date


class RuleViolationError(Exception):
    pass


class NotFoundError(Exception):
    pass


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


def days(start: str, end: str) -> int:
    return (date.fromisoformat(end) - date.fromisoformat(start)).days


class Schedule:
    def __init__(self, space: Space):
        self.space = space
        self._bookings: list[Booking] = []

    def book(self, id, unit, day, start, end, today) -> Booking:
        if end <= start:
            raise RuleViolationError("invalid time slot")
        if days(today, day) < self.space.min_notice_days:
            raise RuleViolationError("minimum notice not met")
        for b in self._bookings:
            if b.date == day and b.start < end and start < b.end:
                raise RuleViolationError(f"time slot overlaps {b.id}")
        base = self.space.fee_cents
        weekend = date.fromisoformat(day).weekday() >= 5
        fee = base + (base * 20 + 50) // 100 if weekend else base
        booking = Booking(id, unit, day, start, end, fee)
        self._bookings.append(booking)
        return booking

    # Returns the cancellation fee in cents: 50% of the fee if less than 2 days are left
    def cancel(self, id: str, today: str) -> int:
        for i, b in enumerate(self._bookings):
            if b.id == id:
                del self._bookings[i]
                return (b.fee_cents * 50 + 50) // 100 if days(today, b.date) < 2 else 0
        raise NotFoundError("booking not found")

    def has(self, id: str) -> bool:
        return any(b.id == id for b in self._bookings)

    def bookings(self) -> list[Booking]:
        return list(self._bookings)
