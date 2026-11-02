# Dates in ISO format (YYYY-MM-DD) and "today" received as a parameter.
from datetime import date


def days_between(iso_date: str, today: date) -> int:
    return (today - date.fromisoformat(iso_date)).days


def date_in_month(today: date, day: int) -> str:
    return today.replace(day=day).isoformat()


def month_label(today: date) -> str:
    return f"{today.month:02d}/{today.year}"


def month_day(iso_date: str) -> str:
    """2026-03-10 -> 03/10"""
    return f"{iso_date[5:7]}/{iso_date[8:10]}"


def us_date(iso_date: str) -> str:
    """2026-03-10 -> 03/10/2026"""
    return f"{month_day(iso_date)}/{iso_date[:4]}"
