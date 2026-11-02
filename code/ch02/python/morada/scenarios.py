# Executable quality scenarios: they generate a synthetic load, measure what is ours,
# estimate what depends on third parties and compare the total with the target.
import time
from dataclasses import dataclass
from datetime import date

from morada.billing.calculation import calculate_charge
from morada.billing.period import period_of
from morada.billing.notification import Notice, format_email
from morada.billing.payment import Invoice


@dataclass(frozen=True)
class Result:
    scenario: dict
    charges: int
    calculation_seconds: float  # measured
    processor_seconds: float  # estimated
    notice_bytes: int
    passed: bool


# Synthetic, deterministic community: the same load in every language
def synthetic_community(i: int, units: int) -> dict:
    unit_list = []
    for k in range(1, units + 1):
        unit_list.append(
            {
                "id": f"U-{k}",
                "shareMillionths": 1000000 // units,
                "resident": {
                    "name": f"Resident {k}",
                    "email": f"resident{k}@example.com",
                    "channel": "email",
                },
                "paymentMethod": "invoice",
                "pastDue": (
                    {"amountCents": 50000, "dueDate": "2026-02-10"}
                    if k % 7 == 0
                    else None
                ),
            }
        )
    expenses = 3000000 + (i % 50) * 10000
    return {
        "community": {
            "id": f"community-{i}",
            "name": f"Community {i}",
            "monthlyExpensesCents": expenses,
        },
        "units": unit_list,
    }


# The scenario's response measure: finish within the limit
def evaluate(seconds: float, limit_seconds: float) -> bool:
    return seconds <= limit_seconds


def run(scenario: dict, today: date) -> Result:
    invoice = Invoice()
    period = period_of(today)
    charges = 0
    notice_bytes = 0
    start = time.perf_counter()
    for i in range(1, scenario["communities"] + 1):
        data = synthetic_community(i, scenario["unitsPerCommunity"])
        community = data["community"]
        for unit in data["units"]:
            charge = calculate_charge(community["monthlyExpensesCents"], unit, today)
            code = invoice.generate_code(community["id"], period, charge)
            notice = Notice(community["name"], period, charge, invoice.name, code)
            notice_bytes += len(format_email(notice).encode("utf-8"))
            charges += 1
    calculation_seconds = time.perf_counter() - start
    # Creating the invoices depends on the payment processor: estimated from its capacity
    processor_seconds = charges / scenario["invoicesPerSecond"]
    total = calculation_seconds + processor_seconds
    return Result(
        scenario,
        charges,
        calculation_seconds,
        processor_seconds,
        notice_bytes,
        evaluate(total, scenario["limitSeconds"]),
    )
