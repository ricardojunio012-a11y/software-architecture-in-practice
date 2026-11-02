# Application layer: the use cases. It takes plain data, calls the domain and the
# repository, and returns plain data. It does not know HTTP exists.
from morada.layers.data import ScheduleRepository
from morada.layers.domain import dollars


def hour(h: int) -> str:
    return f"{h:02d}:00"


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
        return {"booking": b.id, "status": "confirmed", "fee": dollars(b.fee_cents)}

    def cancel(self, booking: str, on: str) -> dict:
        fee = self._schedules.for_booking(booking).cancel(booking, on)
        return {
            "booking": booking,
            "status": "canceled",
            "cancellationFee": dollars(fee),
        }

    def bookings_for_space(self, space: str) -> list[dict]:
        return [
            {
                "booking": b.id,
                "unit": b.unit,
                "slot": f"{b.date} {hour(b.start)}-{hour(b.end)}",
            }
            for b in self._schedules.for_space(space).bookings()
        ]
