from morada.shared.money import percent_of
from morada.after.billing.types import Entry, amount_of


class ReserveFund:
    """A percentage of the monthly dues, for the reserve fund."""

    def __init__(self, percent: int):
        self._percent = percent

    def apply(self, unit, posted):
        reserve = percent_of(amount_of(posted, "dues"), self._percent)
        return [Entry("reserve", f"Reserve fund ({self._percent}%)", reserve)]
