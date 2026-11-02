from morada.shared.money import percent_of
from morada.after.billing.types import Entry


class LateFee:
    """A one-time late fee on the past-due balance."""

    def __init__(self, percent: int):
        self._percent = percent

    def apply(self, unit, posted):
        d = unit["pastDue"]
        if not d:
            return []
        fee = percent_of(d["amountCents"], self._percent)
        return [Entry("late-fee", f"Late fee ({self._percent}%)", fee)]
