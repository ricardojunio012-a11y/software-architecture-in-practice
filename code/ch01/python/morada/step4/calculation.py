# Rules for calculating the monthly dues: reads no file and sends nothing.
from dataclasses import dataclass
from datetime import date

from morada.step4.period import days_since
from morada.step4.money import share_of, percent_of

RESERVE_FUND = 10  # % of the dues
LATE_FEE = 2  # % of the past-due balance (set by the CC&Rs)
EARLY_PAYMENT_DISCOUNT = 5  # % of the dues, if there is no past-due balance


@dataclass(frozen=True)
class Charge:
    unit: dict
    dues: int
    reserve: int
    arrears: int
    late_fee: int
    interest: int
    total: int
    total_by_5th: (
        int | None
    )  # amount with the early-payment discount, if the unit qualifies


# 1% a month, prorated by the days late
def late_interest(cents: int, days: int) -> int:
    return (cents * days + 1500) // 3000


def calculate_charge(expenses_cents: int, unit: dict, today: date) -> Charge:
    dues = share_of(expenses_cents, unit["shareMillionths"])
    reserve = percent_of(dues, RESERVE_FUND)
    arrears = late_fee = interest = 0
    if unit["pastDue"]:
        arrears = unit["pastDue"]["amountCents"]
        late_fee = percent_of(arrears, LATE_FEE)
        interest = late_interest(arrears, days_since(unit["pastDue"]["dueDate"], today))
    total = dues + reserve + arrears + late_fee + interest
    total_by_5th = (
        total - percent_of(dues, EARLY_PAYMENT_DISCOUNT) if arrears == 0 else None
    )
    return Charge(unit, dues, reserve, arrears, late_fee, interest, total, total_by_5th)
