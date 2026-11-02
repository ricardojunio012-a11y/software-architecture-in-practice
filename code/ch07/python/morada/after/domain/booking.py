# Entity: it has an identity (the id) and a life cycle. It changes only through its
# own methods.
from morada.after.domain.error import DomainError
from morada.after.domain.money import Money
from morada.after.domain.time_slot import TimeSlot


class Booking:
    def __init__(self, id: str, unit: str, slot: TimeSlot, fee: Money):
        self.id = id
        self.unit = unit
        self.slot = slot
        self.fee = fee
        self._status = "confirmed"

    @property
    def is_active(self) -> bool:
        return self._status == "confirmed"

    def cancel(self) -> None:
        if not self.is_active:
            raise DomainError("booking is not confirmed")
        self._status = "canceled"
