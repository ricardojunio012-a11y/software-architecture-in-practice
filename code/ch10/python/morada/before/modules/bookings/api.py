# Public API of Bookings. The module declares what it needs to know from Billing
# (FinancialStanding) without depending on how Billing stores its data.
from typing import Protocol

from morada.before.modules.bookings.internal.schedule import Schedule


class FinancialStanding(Protocol):
    def unit_in_good_standing(self, unit: str, today: str) -> bool: ...


class RejectionError(Exception):
    pass


class Bookings:
    def __init__(self, spaces: list[str], billing: FinancialStanding):
        self._schedule = Schedule(spaces)
        self._billing = billing

    def book(self, booking, unit, space, date, today) -> str:
        if not self._billing.unit_in_good_standing(unit, today):
            raise RejectionError(f"unit {unit} in arrears")
        if self._schedule.occupant(space, date):
            raise RejectionError(f"{space} already booked on {date}")
        self._schedule.record(booking, space, date)
        return f"{unit} {space} {date}"
