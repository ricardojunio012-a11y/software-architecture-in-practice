# "Now the hard part": two requests for the same space and the same date
# arrive at the same time. The interleaving is forced, so the output is always
# the same: both go through the chain before either one saves.
from morada.state import Booking
from morada.types import us_date


def race(requests, build) -> list[str]:
    first = requests[0]
    lines = [f"Simultaneous requests: {first.space.name} on {us_date(first.date)}"]
    for guarded in (False, True):
        lines.append(
            "save only if the space is free, in a single operation:"
            if guarded
            else "check, then save (check-then-act):"
        )
        chain, bookings = build()
        # 1. Both check: the space is free for both
        approved = []
        for r in requests:
            d = chain.evaluate(r)
            text = "passed the chain" if d.approved else d.reason
            lines.append(f"  {r.id} {r.unit.id}: {text}")
            if d.approved:
                approved.append(r)
        # 2. Both save
        for r in approved:
            booking = Booking(r)
            saved = bookings.save_if_free(booking) if guarded else True
            if not guarded:
                bookings.save(booking)
            if saved:
                booking.approve()
            outcome = "saved" if saved else "rejected on save"
            lines.append(f"  {r.id} {outcome}")
        n = 0
        for r in requests:
            b = bookings.find(r.id)
            if b is not None and b.state == "approved":
                n += 1
        result = "1 booking approved" if n == 1 else f"{n} bookings approved"
        double = " (double booking)" if n > 1 else ""
        lines.append(f"  result: {result}{double}")
    return lines
