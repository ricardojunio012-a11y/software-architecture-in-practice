# Financial report to owners: receives only what it needs, as parameters.
from datetime import date

from morada.after.charges import Charge
from morada.after.shared.dates import month_label
from morada.after.shared.money import dollars


def financial_report(
    community: str,
    today: date,
    charges: tuple[Charge, ...],
    expenses: list[dict],
    reserve_opening_balance: int,
) -> str:
    dues = sum(c.dues for c in charges)
    reserve = sum(c.reserve for c in charges)
    lines = [f"# Financial report {month_label(today)} - {community}"]
    lines.append(f"income;monthly dues;{dollars(dues)}")
    lines.append(f"income;reserve fund;{dollars(reserve)}")
    for e in expenses:
        lines.append(f"expenses;{e['category']};{dollars(e['amountCents'])}")
    lines.append(f"expenses;total;{dollars(sum(e['amountCents'] for e in expenses))}")
    lines.append(f"reserve;opening balance;{dollars(reserve_opening_balance)}")
    lines.append(
        f"reserve;projected balance;{dollars(reserve_opening_balance + reserve)}"
    )
    return "\n".join(lines) + "\n"
