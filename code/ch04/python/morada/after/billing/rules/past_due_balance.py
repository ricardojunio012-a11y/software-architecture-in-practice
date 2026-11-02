from morada.shared.dates import month_day
from morada.after.billing.types import Entry


class PastDueBalance:
    """The amount left unpaid from the previous month."""

    def apply(self, unit, posted):
        d = unit["pastDue"]
        if not d:
            return []
        description = f"Past-due balance (due {month_day(d['dueDate'])})"
        return [Entry("arrears", description, d["amountCents"])]
