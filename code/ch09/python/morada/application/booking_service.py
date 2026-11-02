# The use cases implement the inbound port and use the outbound port. They do not know
# whether HTTP or the terminal called them, nor where the schedules are kept.
from morada.application.ports import ScheduleRepository
from morada.domain.schedule import dollars, slot


class BookingService:
    def __init__(self, schedules: ScheduleRepository):
        self._schedules = schedules

    def list_spaces(self) -> list[dict]:
        return [
            {
                "id": s.space.id,
                "fee": dollars(s.space.fee_cents),
                "minNoticeDays": s.space.min_notice_days,
            }
            for s in self._schedules.all()
        ]

    def book(self, r: dict) -> dict:
        schedule = self._schedules.for_space(r["space"])
        b = schedule.book(
            r["booking"], r["unit"], r["date"], r["start"], r["end"], r["requestedOn"]
        )
        self._schedules.save(schedule)
        return {
            "booking": b.id,
            "status": "confirmed",
            "fee": dollars(b.fee_cents),
        }

    def cancel(self, booking: str, requested_on: str) -> dict:
        schedule = self._schedules.for_booking(booking)
        fee = schedule.cancel(booking, requested_on)
        self._schedules.save(schedule)
        return {
            "booking": booking,
            "status": "canceled",
            "cancellationFee": dollars(fee),
        }

    def bookings_for_space(self, space: str) -> list[dict]:
        return [
            {"booking": b.id, "unit": b.unit, "slot": slot(b)}
            for b in self._schedules.for_space(space).bookings()
        ]
