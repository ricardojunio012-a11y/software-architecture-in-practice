# Dates come in as parameters: no hidden clock.
from datetime import date


def days_between(iso_date: str, today: date) -> int:
    return (today - date.fromisoformat(iso_date)).days


def month_label(today: date) -> str:
    return f"{today.month:02d}/{today.year}"
