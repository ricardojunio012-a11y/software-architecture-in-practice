# Service that holds every rule. The rules only apply if whoever changes the data
# remembers to go through here; nothing stops other code from changing bookings directly.
from datetime import date

from morada.before.model import Booking, bookings


def days(start, end):
    return (date.fromisoformat(end) - date.fromisoformat(start)).days


def format_money(cents):
    return f"${cents // 100:,}.{cents % 100:02d}"


def hours(start, end):
    return f"{start:02d}:00-{end:02d}:00"


def book(c, space, events):
    if c["end"] <= c["start"]:
        return "rejected;invalid time slot: the end must be after the start"
    if days(c["requestedOn"], c["date"]) < space["minNoticeDays"]:
        return "rejected;minimum notice not met"
    for b in bookings:
        same_time = b.date == c["date"] and b.start < c["end"] and c["start"] < b.end
        if b.space == c["space"] and b.status == "confirmed" and same_time:
            return f"rejected;time slot overlaps {b.id}"
    this_month = [
        b
        for b in bookings
        if b.space == c["space"]
        and b.unit == c["unit"]
        and b.status == "confirmed"
        and b.date[:7] == c["date"][:7]
    ]
    if len(this_month) >= space["monthlyLimit"]:
        return "rejected;unit's monthly limit reached"

    fee = space["feeCents"]
    if date.fromisoformat(c["date"]).weekday() >= 5:
        fee += (fee * 20 + 50) // 100
    b = Booking(c["booking"], c["unit"], c["space"], c["date"])
    b.start, b.end, b.fee_cents = c["start"], c["end"], fee
    bookings.append(b)
    slot = f"{c['date']} {hours(c['start'], c['end'])}"
    events.append(
        f"BookingConfirmed;{b.id};{b.space};{slot};{b.unit};{format_money(fee)}"
    )
    return f"confirmed;{format_money(fee)}"


def cancel(c, events):
    b = next((x for x in bookings if x.id == c["booking"]), None)
    if not b:
        return "not canceled;booking not found"
    if b.status != "confirmed":
        return "not canceled;booking is not confirmed"
    b.status = "canceled"
    late = days(c["requestedOn"], b.date) < 2
    fee = (b.fee_cents * 50 + 50) // 100 if late else 0
    detail = (
        f"cancellation fee {format_money(fee)}" if fee > 0 else "no cancellation fee"
    )
    events.append(f"BookingCanceled;{b.id};{detail}")
    return f"canceled;{detail}"
