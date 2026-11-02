# Assorted utilities: whatever did not fit anywhere else (coincidental cohesion).
from datetime import date

from morada.before.config.config import config


def dollars(c):
    return f"{c // 100:,}" + "." + f"{c % 100:02d}"


# Depends, without saying so, on the date kept in the global configuration
def days_late(due_date):
    return (config.today - date.fromisoformat(due_date)).days


def period():
    return f"{config.today.month:02d}/{config.today.year}"
