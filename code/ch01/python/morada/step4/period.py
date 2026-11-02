# The billing period of the charge and the dates that depend on it.
from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class BillingPeriod:
    today: date
    label: str  # "03/2026"
    code: str  # "202603"
    due_date: str  # "03/10/2026"
    discount_deadline: str  # "03/05/2026"


def period_of(today: date) -> BillingPeriod:
    month = f"{today.month:02d}"
    return BillingPeriod(
        today,
        f"{month}/{today.year}",
        f"{today.year}{month}",
        f"{month}/10/{today.year}",
        f"{month}/05/{today.year}",
    )


# Calendar days between a date (YYYY-MM-DD) and today
def days_since(iso_date: str, today: date) -> int:
    return (today - date.fromisoformat(iso_date)).days
