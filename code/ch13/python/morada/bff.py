# The Backend for Frontend of the front-desk staff app. It belongs to the app team and
# speaks the language of the screen: it gathers in one call what the tablet needs and
# receives the operations made offline, in a batch, applying each one only once.
from morada.backend import Bookings, FrontDesk


class StaffBff:
    # Without the third argument, the results live only in this process's memory
    def __init__(
        self,
        front_desk: FrontDesk,
        bookings: Bookings,
        results: dict[str, str] | None = None,
    ):
        self._front_desk = front_desk
        self._bookings = bookings
        self._results = {} if results is None else results
        self.repeated = 0

    # The whole home screen in one call, with only the fields the tablet shows
    def home(self) -> dict:
        pending = [
            {"id": p["id"], "unit": p["unit"], "version": p["version"]}
            for p in self._front_desk.packages.values()
            if p["status"] == "at front desk"
        ]
        # Compares name and booking field by field: "Anna" must not match "Mary Anna"
        entered = {(v["name"], v["booking"]) for v in self._front_desk.visitors}
        expected = [
            g
            for g in self._bookings.guests()
            if (g["name"], g["booking"]) not in entered
        ]
        return {"pendingPackages": pending, "expectedVisitors": expected}

    # Idempotent by operation id: a resent batch applies nothing twice
    def sync(self, tablet: str, operations: list[dict]) -> list[tuple[dict, str]]:
        output = []
        for op in operations:
            if op["id"] in self._results:
                self.repeated += 1
                output.append((op, self._results[op["id"]]))
                continue
            if op["type"] == "registerVisitor":
                result = self._front_desk.register_visitor(
                    op["name"], op["booking"], tablet, op["time"]
                )
            else:
                status = "delivered" if op["type"] == "deliver" else "returned"
                result = self._front_desk.change(
                    op["packageId"], status, op["seenVersion"], tablet, op["time"]
                )
            self._results[op["id"]] = result
            output.append((op, result))
        return output
