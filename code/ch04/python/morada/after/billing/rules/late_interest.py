from datetime import date

from morada.shared.dates import days_between
from morada.after.billing.types import Entry


class LateInterest:
    """Monthly interest, prorated by the days late (30-day month)."""

    def __init__(self, monthly_percent: int, today: date):
        self._monthly_percent = monthly_percent
        self._today = today

    def apply(self, unit, posted):
        d = unit["pastDue"]
        if not d:
            return []
        days = days_between(d["dueDate"], self._today)
        interest = (d["amountCents"] * self._monthly_percent * days + 1500) // 3000
        return [Entry("interest", f"Interest ({days} days)", interest)]
