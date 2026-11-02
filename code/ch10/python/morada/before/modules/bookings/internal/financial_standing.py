# Before: the shortcut. Bookings reads the Billing table directly and reimplements
# the delinquency rule on its own, unaware that an installment agreement keeps the
# unit in good standing.
from morada.before.modules.billing.internal.charges_table import ChargesTable


class StandingFromTable:
    def __init__(self, table: ChargesTable):
        self._table = table

    def unit_in_good_standing(self, unit: str, today: str) -> bool:
        return not any(
            r.unit == unit and r.status != "paid" and r.due_date < today
            for r in self._table.rows
        )
