# Repository: one per aggregate. It saves the whole schedule, never a single booking.
from morada.after.domain.error import DomainError
from morada.after.domain.schedule import Schedule, UsagePolicy


class InMemorySchedules:
    """In memory in the lab; chapter 16 keeps the schedules in a database."""

    def __init__(self, policies: dict[str, UsagePolicy]):
        self._schedules = {s: Schedule(s, p) for s, p in policies.items()}

    def for_space(self, space: str) -> Schedule:
        if space not in self._schedules:
            raise DomainError(f"unknown space: {space}")
        return self._schedules[space]

    def for_booking(self, booking: str) -> Schedule:
        schedule = next((s for s in self._schedules.values() if s.has(booking)), None)
        if not schedule:
            raise DomainError("booking not found")
        return schedule

    def save(self, schedule: Schedule) -> None:
        self._schedules[schedule.space] = schedule

    def all(self) -> list[Schedule]:
        return list(self._schedules.values())
