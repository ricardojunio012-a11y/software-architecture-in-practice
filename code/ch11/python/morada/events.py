# Integration event published by Billing. It carries the data the subscribers need
# (event-carried state transfer), so they do not have to query Billing.


# The event identifier is stable: the same payment always produces the same event
def event_for(p: dict) -> dict:
    return {
        "event": f"E-{p['payment']}",
        "type": "PaymentConfirmed",
        "payment": p["payment"],
        "unit": p["unit"],
        "booking": p["booking"],
        "amountCents": p["amountCents"],
    }


def dollars(cents: int) -> str:
    return f"${cents // 100:,}.{cents % 100:02d}"
