# Private data of Bookings: one space, one booking per day (simplified).
class Schedule:
    def __init__(self, spaces: list[str]):
        self._spaces = set(spaces)
        self._occupancy: dict[str, str] = {}

    def occupant(self, space: str, date: str) -> str | None:
        if space not in self._spaces:
            raise LookupError(f"space {space} does not exist")
        return self._occupancy.get(f"{space} {date}")

    def record(self, booking: str, space: str, date: str) -> None:
        self._occupancy[f"{space} {date}"] = booking
