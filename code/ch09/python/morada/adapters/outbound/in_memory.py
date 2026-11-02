# In-memory outbound adapter: fast and dependency-free, good for tests.
# Everything is gone when the process ends.
from morada.domain.schedule import NotFoundError, Schedule, Space


class InMemorySchedules:
    def __init__(self, spaces: list[Space]):
        self._schedules = {s.id: Schedule(s) for s in spaces}

    def all(self) -> list[Schedule]:
        return list(self._schedules.values())

    def for_space(self, space: str) -> Schedule:
        if space not in self._schedules:
            raise NotFoundError("space not found")
        return self._schedules[space]

    def for_booking(self, booking: str) -> Schedule:
        for s in self._schedules.values():
            if any(b.id == booking for b in s.bookings()):
                return s
        raise NotFoundError("booking not found")

    # The in-memory schedule is the changed object itself: there is nothing to write
    def save(self, schedule: Schedule) -> None:
        pass
