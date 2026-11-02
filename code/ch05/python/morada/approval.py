# Chain of Responsibility: each stage checks one rule and, if the request passes,
# hands it to the next. The skeleton of evaluate() is a Template Method.
from abc import ABC, abstractmethod
from datetime import date

from morada.repository import BookingRepository
from morada.types import BookingRequest, Decision, days_between


class Stage(ABC):
    _next: "Stage | None" = None

    def and_then(self, next: "Stage") -> "Stage":
        """Returns the next stage, for chaining: a.and_then(b).and_then(c)"""
        self._next = next
        return next

    def evaluate(self, request: BookingRequest) -> Decision:
        reason = self.check(request)
        if reason:
            return Decision(False, reason)
        return self._next.evaluate(request) if self._next else Decision(True)

    @abstractmethod
    def check(self, request: BookingRequest) -> str | None:
        """Each stage gives the reason for rejecting, or None if the request passed."""


class UnitInGoodStanding(Stage):
    def check(self, request):
        return "unit in arrears" if request.unit.in_arrears else None


class MinimumNotice(Stage):
    def __init__(self, today: date):
        self._today = today

    def check(self, request):
        minimum = request.space.min_notice_days
        if days_between(self._today, request.date) >= minimum:
            return None
        return f"minimum notice of {minimum} days"


class SpaceAvailable(Stage):
    def __init__(self, bookings: BookingRepository):
        self._bookings = bookings

    def check(self, request):
        taken = self._bookings.is_taken(request.space.id, request.date)
        return "space already booked on this date" if taken else None


class MonthlyLimit(Stage):
    def __init__(self, bookings: BookingRepository):
        self._bookings = bookings

    def check(self, request):
        made = self._bookings.count_in_month(
            request.unit.id, request.space.id, request.date[:7]
        )
        if made < request.space.monthly_limit:
            return None
        return "monthly booking limit reached"
