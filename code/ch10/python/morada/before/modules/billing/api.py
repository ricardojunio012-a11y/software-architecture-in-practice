# Public API of Billing: the only door the other modules may use.
from morada.before.modules.billing.internal.charges_table import (
    ChargeRow,
    ChargesTable,
)


def dollars(cents: int) -> str:
    return f"${cents // 100:,}.{cents % 100:02d}"


class Billing:
    def __init__(self, table: ChargesTable):
        self._table = table

    def issue(self, charge, unit, amount_cents, due_date) -> str:
        self._table.rows.append(ChargeRow(charge, unit, amount_cents, due_date))
        return f"{unit} {dollars(amount_cents)} due {due_date}"

    def pay(self, charge: str, on: str) -> str:
        self._table.find(charge).status = "paid"
        return f"on {on}"

    def split(self, charge: str, installments: int) -> str:
        row = self._table.find(charge)
        row.status = "split"
        row.installments = installments
        return f"{installments} installments"

    # Delinquency rule: a charge split into installments under an agreement is not debt
    def unit_in_good_standing(self, unit: str, today: str) -> bool:
        return not any(
            r.unit == unit and r.status == "open" and r.due_date < today
            for r in self._table.rows
        )
