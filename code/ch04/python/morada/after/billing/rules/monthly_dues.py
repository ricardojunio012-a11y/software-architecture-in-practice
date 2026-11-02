from morada.shared.money import share_of
from morada.after.billing.types import Entry


class MonthlyDues:
    """The unit's part of the month's expenses, by its ownership share."""

    def __init__(self, monthly_expenses: int):
        self._expenses = monthly_expenses

    def apply(self, unit, posted):
        dues = share_of(self._expenses, unit["shareMillionths"])
        return [Entry("dues", "Monthly dues", dues)]
