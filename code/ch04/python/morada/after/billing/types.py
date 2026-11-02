# The types the calculator depends on. None of them knows a concrete rule.
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class Entry:
    """Charge item. Conditional: it applies only if paid by the discount date."""

    code: str
    description: str
    amount: int
    conditional: bool = False


class Rule(Protocol):
    """Each rule looks at the unit and at what was posted and returns what it adds."""

    def apply(self, unit: dict, posted: list[Entry]) -> list[Entry]: ...


def amount_of(posted: list[Entry], code: str) -> int:
    return sum(e.amount for e in posted if e.code == code)
