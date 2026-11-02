# Sprout class (Feathers): the new rule is born outside the legacy code, in a new,
# small class with its own tests. The legacy code only gains a call.

# Bookings per unit, per space, in the same month
DEFAULT_LIMITS = {"party-room": 1, "grill-area": 2}


class MonthlyLimit:
    def __init__(self, limits=None):
        self._limits = DEFAULT_LIMITS if limits is None else limits

    def reached(self, request, approved) -> bool:
        limit = self._limits.get(request["space"])
        if limit is None:
            return False
        month = request["date"][:7]
        made = [
            b
            for b in approved
            if b["unit"] == request["unit"]
            and b["space"] == request["space"]
            and b["date"][:7] == month
        ]
        return len(made) >= limit
