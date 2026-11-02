# Internal billing rules, used only by the module itself.
from datetime import date

from morada.after.shared.dates import days_between
from morada.after.shared.money import percent_of

_RESERVE_FUND = 10  # % of the dues
_LATE_FEE = 2  # % of the arrears


def reserve_fund(dues: int) -> int:
    return percent_of(dues, _RESERVE_FUND)


def late_charges(arrears: int, due_date: str, today: date) -> dict:
    days = days_between(due_date, today)
    interest = (arrears * days + 1500) // 3000  # 1% a month, prorated
    return {
        "days": days,
        "late_fee": percent_of(arrears, _LATE_FEE),
        "interest": interest,
    }
