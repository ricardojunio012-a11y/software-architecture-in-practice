# Value object: immutable, compared by value, and owner of its own rules.
from dataclasses import dataclass

from morada.after.domain.error import DomainError


@dataclass(frozen=True)
class Money:
    cents: int

    def __post_init__(self):
        if not isinstance(self.cents, int) or self.cents < 0:
            raise DomainError("a money amount must be a whole number of cents")

    def add(self, other: "Money") -> "Money":
        return Money(self.cents + other.cents)

    def percent(self, percent: int) -> "Money":
        """Percentage rounded half up, always in the same place."""
        return Money((self.cents * percent + 50) // 100)

    def __str__(self) -> str:
        return f"${self.cents // 100:,}.{self.cents % 100:02d}"


ZERO = Money(0)
