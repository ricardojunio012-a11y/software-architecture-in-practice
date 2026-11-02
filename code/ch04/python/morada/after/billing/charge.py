# The charge of one unit. Information expert (GRASP): whoever has the entries is the
# one who calculates the totals.
from dataclasses import dataclass

from morada.after.billing.types import Entry


@dataclass(frozen=True)
class Charge:
    unit: str
    resident: str
    entries: tuple[Entry, ...]

    @property
    def total(self) -> int:
        return sum(e.amount for e in self.entries if not e.conditional)

    @property
    def discount(self) -> int:
        """Conditional discount, as a positive amount"""
        return -sum(e.amount for e in self.entries if e.conditional)
