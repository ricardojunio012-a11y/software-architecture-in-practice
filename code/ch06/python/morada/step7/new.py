# The new code: the refactored module from step 5 plus the limit rule, which was
# already born separate in step 6 (the sprout class) and so migrates without a rewrite.
from datetime import date

from morada.step5.bookings import Decision, booking_amount, decline_reason
from morada.step6.limit import MonthlyLimit


def decide(data: dict, today: date, limit=None) -> list[Decision]:
    limit = limit or MonthlyLimit()
    approved, decisions = [], []
    for request in data["requests"]:
        unit = next(u for u in data["units"] if u["id"] == request["unit"])
        space = next(s for s in data["spaces"] if s["id"] == request["space"])
        reason = decline_reason(request, unit, today, approved)
        if not reason and limit.reached(request, approved):
            reason = "monthly booking limit reached"
        amount = 0
        if not reason:
            approved.append(request)
            amount = booking_amount(space, request)
        decisions.append(Decision(request, unit["email"], reason, amount))
    return decisions
