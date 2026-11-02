# Value object: a period of use within one day. The end never comes before the start.
from dataclasses import dataclass
from datetime import date

from morada.after.domain.error import DomainError


@dataclass(frozen=True)
class TimeSlot:
    date: str
    start: int
    end: int

    def __post_init__(self):
        if self.end <= self.start:
            raise DomainError("invalid time slot: the end must be after the start")

    def overlaps(self, other: "TimeSlot") -> bool:
        return (
            self.date == other.date
            and self.start < other.end
            and other.start < self.end
        )

    def month(self) -> str:
        return self.date[:7]

    def days_since(self, day: str) -> int:
        return (date.fromisoformat(self.date) - date.fromisoformat(day)).days

    def is_weekend(self) -> bool:
        return date.fromisoformat(self.date).weekday() >= 5

    def __str__(self) -> str:
        return f"{self.date} {self.start:02d}:00-{self.end:02d}:00"
