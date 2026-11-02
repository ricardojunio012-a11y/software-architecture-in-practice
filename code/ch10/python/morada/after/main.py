# Usage: python -m morada.after.main <commands.json> <output-folder>
# Wires the modules and runs the Billing and Bookings commands in order.
import json
import sys
from pathlib import Path

from morada.after.modules.billing.api import Billing
from morada.after.modules.billing.internal.charges_table import ChargesTable
from morada.after.modules.bookings.api import Bookings, RejectionError
from morada.after.modules.bookings.internal.financial_standing import (
    StandingFromBilling,
)

input_file, output = sys.argv[1], Path(sys.argv[2])
data = json.loads(Path(input_file).read_text(encoding="utf-8"))
billing = Billing(ChargesTable())
bookings = Bookings(data["spaces"], StandingFromBilling(billing))


def execute(c: dict) -> tuple[str, str, str]:
    if c["type"] == "issue":
        detail = billing.issue(c["charge"], c["unit"], c["amountCents"], c["dueDate"])
        return c["charge"], "issued", detail
    if c["type"] == "pay":
        return c["charge"], "paid", billing.pay(c["charge"], c["on"])
    if c["type"] == "split":
        return c["charge"], "split", billing.split(c["charge"], c["installments"])
    try:
        detail = bookings.book(c["booking"], c["unit"], c["space"], c["date"], c["on"])
        return c["booking"], "confirmed", detail
    except RejectionError as error:
        return c["booking"], "rejected", str(error)


lines = []
for c in data["commands"]:
    id, status, detail = execute(c)
    lines.append(f"{id};{c['type']};{status};{detail}")
output.mkdir(parents=True, exist_ok=True)
(output / "results.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"{len(lines)} commands executed; output in {output}")
