# Public interface of the charges module: the other modules import only from here.
from dataclasses import dataclass
from datetime import date

from morada.after.charges.rules import late_charges, reserve_fund
from morada.after.shared.dates import month_label
from morada.after.shared.money import dollars, share_of

__all__ = ["Charge", "calculate_charges", "charge_report"]


@dataclass(frozen=True)
class Charge:
    unit: str
    resident: str
    dues: int
    reserve: int
    arrears: int
    days_late: int
    late_fee: int
    interest: int
    total: int


def calculate_charges(expenses: int, units: list, today: date) -> tuple[Charge, ...]:
    result = []
    for u in units:
        dues = share_of(expenses, u["shareMillionths"])
        reserve = reserve_fund(dues)
        p = u["pastDue"]
        arrears = p["amountCents"] if p else 0
        lc = (
            late_charges(arrears, p["dueDate"], today)
            if p
            else {"days": 0, "late_fee": 0, "interest": 0}
        )
        total = dues + reserve + arrears + lc["late_fee"] + lc["interest"]
        result.append(
            Charge(
                u["id"],
                u["resident"]["name"],
                dues,
                reserve,
                arrears,
                lc["days"],
                lc["late_fee"],
                lc["interest"],
                total,
            )
        )
    return tuple(result)


def charge_report(community: str, today: date, charges) -> str:
    lines = [f"# Charges {month_label(today)} - {community}"]
    lines.append("unit;resident;dues;reserve;arrears;late_fee;interest;total")
    for c in charges:
        amounts = [
            dollars(v)
            for v in (c.dues, c.reserve, c.arrears, c.late_fee, c.interest, c.total)
        ]
        lines.append(";".join([c.unit, c.resident, *amounts]))
    return "\n".join(lines) + "\n"
