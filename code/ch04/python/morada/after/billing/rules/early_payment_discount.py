from morada.shared.dates import month_day
from morada.shared.money import percent_of
from morada.after.billing.types import Entry, amount_of


class EarlyPaymentDiscount:
    """Discount on the dues owed for whoever pays by the agreed day.
    A unit with a past-due balance gets no discount (the chapter 1 rule)."""

    def __init__(self, percent: int, until: str):
        self._percent = percent
        self._until = until

    def apply(self, unit, posted):
        dues_owed = amount_of(posted, "dues") + amount_of(posted, "exemption")
        if dues_owed <= 0 or amount_of(posted, "arrears") > 0:
            return []
        description = f"Discount by {month_day(self._until)} ({self._percent}%)"
        discount = percent_of(dues_owed, self._percent)
        return [Entry("discount", description, -discount, conditional=True)]
