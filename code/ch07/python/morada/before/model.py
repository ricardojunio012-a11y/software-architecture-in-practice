# Anemic model: only data, all public and writable. No rule lives here.
from dataclasses import dataclass


@dataclass
class Booking:
    id: str = ""
    unit: str = ""
    space: str = ""
    date: str = ""
    start: int = 0
    end: int = 0
    status: str = "confirmed"
    fee_cents: int = 0


# The data of every booking, which any part of the system can read and change
bookings: list[Booking] = []
