# The Morada back end (the monolith): Front Desk handles packages and visitors;
# Bookings knows who the guests of each party are. Neither one knows about screens.


class FrontDesk:
    def __init__(self, packages: list[dict]):
        self.packages = {
            p["id"]: {**p, "status": "at front desk", "version": 1} for p in packages
        }
        self.visitors: list[dict] = []

    # Optimistic concurrency: changes only if nobody changed it since the seen version
    def change(self, id, status, seen_version, tablet, time) -> str:
        p = self.packages[id]
        if p["version"] != seen_version:
            by = f"by tablet {p['by']} at {p['time']}"
            return f"conflict: {id} already {p['status']} {by}"
        p.update(status=status, version=p["version"] + 1, by=tablet, time=time)
        return "applied"

    def register_visitor(self, name, booking, tablet, time) -> str:
        self.visitors.append(
            {"name": name, "booking": booking, "tablet": tablet, "time": time}
        )
        return "applied"


class Bookings:
    def __init__(self, parties: list[dict]):
        self._guests = [
            {"name": name, "booking": p["booking"], "space": p["space"]}
            for p in parties
            for name in p["names"]
        ]

    def guests(self) -> list[dict]:
        return list(self._guests)
