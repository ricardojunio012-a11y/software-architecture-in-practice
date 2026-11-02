# Delinquency report: reads the charges, never changes them.
from datetime import date

from morada.after.charges import Charge
from morada.after.shared.dates import month_label
from morada.after.shared.money import dollars


def delinquency_report(community: str, today: date, charges: tuple[Charge, ...]) -> str:
    in_arrears = sorted(
        (c for c in charges if c.arrears > 0), key=lambda c: c.arrears, reverse=True
    )
    lines = [f"# Delinquency {month_label(today)} - {community}"]
    lines.append("unit;resident;days;arrears;late_fee;interest;amount_due")
    total = [0, 0, 0, 0]
    for c in in_arrears:
        values = [
            c.arrears,
            c.late_fee,
            c.interest,
            c.arrears + c.late_fee + c.interest,
        ]
        total = [s + v for s, v in zip(total, values)]
        lines.append(
            ";".join(
                [c.unit, c.resident, str(c.days_late)] + [dollars(v) for v in values]
            )
        )
    lines.append(";".join(["total", "", ""] + [dollars(s) for s in total]))
    return "\n".join(lines) + "\n"
