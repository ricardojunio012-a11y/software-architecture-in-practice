# Bookings subscribes to PaymentConfirmed: the booking awaiting payment is confirmed.
# The subscriber is idempotent, because the broker delivers "at least once".


class Bookings:
    def __init__(self, initial: list[dict]):
        self._bookings = {
            b["booking"]: {**b, "status": "awaiting payment"} for b in initial
        }
        self._processed: set[str] = set()
        self.log: list[str] = []

    def on_payment_confirmed(self, e: dict) -> None:
        if e["event"] in self._processed:
            self.log.append(f"bookings ignored {e['event']} (duplicate)")
            return
        self._processed.add(e["event"])
        self._bookings[e["booking"]]["status"] = "confirmed"
        self.log.append(f"bookings received {e['event']}: {e['booking']} confirmed")

    def lines(self) -> list[str]:
        return [
            f"{b['booking']};{b['unit']};{b['space']};{b['date']};{b['status']}"
            for b in self._bookings.values()
        ]
