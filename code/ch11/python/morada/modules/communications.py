# Communications subscribes to the same event and notifies the resident. It does not
# know Bookings: everything it needs came inside the event.
from morada.events import dollars


class Communications:
    def __init__(self):
        self._processed: set[str] = set()
        self.notices: list[str] = []
        self.log: list[str] = []

    def on_payment_confirmed(self, e: dict) -> None:
        if e["event"] in self._processed:
            self.log.append(f"communications ignored {e['event']} (duplicate)")
            return
        self._processed.add(e["event"])
        amount = dollars(e["amountCents"])
        self.notices.append(
            f"{e['unit']}: payment {e['payment']} of {amount} received; "
            f"booking {e['booking']} confirmed"
        )
        self.log.append(f"communications received {e['event']}: notified {e['unit']}")
