# The booking data and small date and money functions.
from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class Space:
    id: str
    name: str
    fee_cents: int
    min_notice_days: int
    monthly_limit: int


@dataclass(frozen=True)
class Resident:
    name: str
    email: str
    channel: str
    phone: str | None = None
    device: str | None = None


@dataclass(frozen=True)
class Unit:
    id: str
    in_arrears: bool
    resident: Resident


@dataclass(frozen=True)
class BookingRequest:
    id: str
    unit: Unit
    space: Space
    date: str


@dataclass(frozen=True)
class Decision:
    approved: bool
    reason: str | None = None


def days_between(today: date, iso_date: str) -> int:
    return (date.fromisoformat(iso_date) - today).days


def us_date(iso_date: str) -> str:
    """2026-03-14 -> 03/14/2026"""
    year, month, day = iso_date.split("-")
    return f"{month}/{day}/{year}"


def dollars(c: int) -> str:
    """15000 -> 150.00 (US format)"""
    return f"{c // 100:,}.{c % 100:02d}"
