# Bookings module. Step 5: separate phases (Split Phase) and no global state.
# decide() calculates; report() and notices() format; main reads and writes.
from dataclasses import dataclass
from datetime import date

MIN_NOTICE_DAYS = 2
SATURDAY_SURCHARGE_PERCENT = 20
GUEST_LIMIT = 50
EXTRA_CLEANING_FEE = 5000  # cents


@dataclass(frozen=True)
class Decision:
    request: dict
    email: str
    reason: str | None
    amount: int


def days_until(iso_date: str, today: date) -> int:
    return (date.fromisoformat(iso_date) - today).days


# The original comment said "weekend", but the code only checks Saturday
def is_saturday(iso_date: str) -> bool:
    return date.fromisoformat(iso_date).weekday() == 5


def booking_amount(space: dict, request: dict) -> int:
    amount = space["fee"]
    if is_saturday(request["date"]):
        amount += amount * SATURDAY_SURCHARGE_PERCENT // 100
    if request["guests"] > GUEST_LIMIT:
        amount += EXTRA_CLEANING_FEE
    return amount


def decline_reason(request, unit, today, approved) -> str | None:
    if unit["inArrears"]:
        return "arrears"
    if days_until(request["date"], today) < MIN_NOTICE_DAYS:
        return "short notice"
    taken = any(
        b["space"] == request["space"] and b["date"] == request["date"]
        for b in approved
    )
    return "conflict" if taken else None


def decide(data: dict, today: date) -> list[Decision]:
    """Phase 1: decide each request, in order. The approved list is now local."""
    approved, decisions = [], []
    for request in data["requests"]:
        unit = next(u for u in data["units"] if u["id"] == request["unit"])
        space = next(s for s in data["spaces"] if s["id"] == request["space"])
        reason = decline_reason(request, unit, today, approved)
        amount = 0
        if not reason:
            approved.append(request)
            amount = booking_amount(space, request)
        decisions.append(Decision(request, unit["email"], reason, amount))
    return decisions


def dollars(cents: int) -> str:
    return f"{cents // 100}.{cents % 100:02d}"


def report(decisions: list[Decision]) -> list[str]:
    """Phase 2: format the report and the notices from the decisions."""
    lines = []
    for d in decisions:
        r = d.request
        head = f"{r['id']};{r['unit']};{r['space']};{r['date']}"
        tail = f"declined;{d.reason}" if d.reason else f"approved;{dollars(d.amount)}"
        lines.append(f"{head};{tail}")
    return lines


def notices(decisions: list[Decision]) -> list[tuple[str, str]]:
    def text(d: Decision) -> str:
        booking = f"Booking {d.request['id']}"
        if d.reason:
            return f"{booking} declined ({d.reason})"
        return f"{booking} confirmed. Amount: ${dollars(d.amount)}"

    return [(d.email, text(d)) for d in decisions]
