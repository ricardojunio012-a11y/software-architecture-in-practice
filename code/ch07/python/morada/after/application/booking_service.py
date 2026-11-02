# Application service: translates a command into calls to the domain. It loads the
# aggregate, asks it to do the work, saves it and publishes the events. No business rule.
from dataclasses import dataclass

from morada.after.domain.error import DomainError
from morada.after.domain.time_slot import TimeSlot


@dataclass(frozen=True)
class Result:
    booking: str
    command: str
    status: str
    detail: str


class BookingService:
    def __init__(self, schedules, publish):
        self._schedules = schedules
        self._publish = publish

    def execute(self, c: dict) -> Result:
        try:
            if c["type"] == "book":
                return self._book(c)
            return self._cancel(c)
        except DomainError as error:
            status = "rejected" if c["type"] == "book" else "not canceled"
            return Result(c["booking"], c["type"], status, str(error))

    def _book(self, c: dict) -> Result:
        slot = TimeSlot(c["date"], c["start"], c["end"])
        schedule = self._schedules.for_space(c["space"])
        booking = schedule.book(c["booking"], c["unit"], slot, c["requestedOn"])
        self._save(schedule)
        return Result(c["booking"], c["type"], "confirmed", str(booking.fee))

    def _cancel(self, c: dict) -> Result:
        schedule = self._schedules.for_booking(c["booking"])
        fee = schedule.cancel(c["booking"], c["requestedOn"])
        self._save(schedule)
        detail = f"cancellation fee {fee}" if fee.cents > 0 else "no cancellation fee"
        return Result(c["booking"], c["type"], "canceled", detail)

    def _save(self, schedule) -> None:
        self._schedules.save(schedule)
        for event in schedule.collect_events():
            self._publish(event)
