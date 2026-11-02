# Aggregate: the schedule of a space is the consistency boundary. The rules that
# involve several bookings (no overlaps, a limit per unit) can only be guaranteed by
# whoever knows all of them. Nobody outside changes a booking without going through here.
from dataclasses import dataclass

from morada.after.domain.booking import Booking
from morada.after.domain.error import DomainError
from morada.after.domain.events import BookingCanceled, BookingConfirmed
from morada.after.domain.money import ZERO, Money
from morada.after.domain.time_slot import TimeSlot

WEEKEND_SURCHARGE_PERCENT = 20
CANCELLATION_FEE_PERCENT = 50
FREE_CANCELLATION_DAYS = 2


@dataclass(frozen=True)
class UsagePolicy:
    fee: Money
    min_notice_days: int
    monthly_limit: int


class Schedule:
    def __init__(self, space: str, policy: UsagePolicy):
        self.space = space
        self._policy = policy
        self._bookings: list[Booking] = []
        self._events: list = []

    def book(self, id: str, unit: str, slot: TimeSlot, today: str) -> Booking:
        if slot.days_since(today) < self._policy.min_notice_days:
            raise DomainError("minimum notice not met")
        conflict = next((b for b in self.active() if b.slot.overlaps(slot)), None)
        if conflict:
            raise DomainError(f"time slot overlaps {conflict.id}")
        this_month = [
            b
            for b in self.active()
            if b.unit == unit and b.slot.month() == slot.month()
        ]
        if len(this_month) >= self._policy.monthly_limit:
            raise DomainError("unit's monthly limit reached")
        booking = Booking(id, unit, slot, self._fee_for(slot))
        self._bookings.append(booking)
        self._events.append(BookingConfirmed(id, self.space, slot, unit, booking.fee))
        return booking

    def cancel(self, id: str, today: str) -> Money:
        booking = next((b for b in self._bookings if b.id == id), None)
        if not booking:
            raise DomainError("booking not found")
        booking.cancel()
        last_minute = booking.slot.days_since(today) < FREE_CANCELLATION_DAYS
        cancellation_fee = (
            booking.fee.percent(CANCELLATION_FEE_PERCENT) if last_minute else ZERO
        )
        self._events.append(BookingCanceled(id, cancellation_fee))
        return cancellation_fee

    def has(self, id: str) -> bool:
        return any(b.id == id for b in self._bookings)

    def active(self) -> list[Booking]:
        return [b for b in self._bookings if b.is_active]

    def collect_events(self) -> list:
        """Whoever saves the aggregate collects the events to publish them afterward."""
        events, self._events = self._events, []
        return events

    def _fee_for(self, slot: TimeSlot) -> Money:
        fee = self._policy.fee
        if not slot.is_weekend():
            return fee
        return fee.add(fee.percent(WEEKEND_SURCHARGE_PERCENT))
