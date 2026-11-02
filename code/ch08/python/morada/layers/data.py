# Data layer: where the schedules are stored. Today, in memory; in chapter 16,
# in a database. The layers above do not notice the change.
from morada.layers.domain import NotFoundError, Schedule, Space


class ScheduleRepository:
    def __init__(self, spaces: list[Space]):
        self._schedules = {s.id: Schedule(s) for s in spaces}

    def all(self) -> list[Schedule]:
        return list(self._schedules.values())

    def for_space(self, id: str) -> Schedule:
        if id not in self._schedules:
            raise NotFoundError("space not found")
        return self._schedules[id]

    def for_booking(self, id: str) -> Schedule:
        for schedule in self._schedules.values():
            if schedule.has(id):
                return schedule
        raise NotFoundError("booking not found")
