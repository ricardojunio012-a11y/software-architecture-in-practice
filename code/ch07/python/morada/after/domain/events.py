# Domain events: facts that have already happened, in the vocabulary of the business.
from dataclasses import dataclass

from morada.after.domain.money import Money
from morada.after.domain.time_slot import TimeSlot


@dataclass(frozen=True)
class BookingConfirmed:
    booking: str
    space: str
    slot: TimeSlot
    unit: str
    fee: Money


@dataclass(frozen=True)
class BookingCanceled:
    booking: str
    cancellation_fee: Money
