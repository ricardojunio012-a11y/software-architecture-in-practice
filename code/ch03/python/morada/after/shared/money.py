# Amounts in cents, rounded half up. Depends on no other module.


def share_of(cents: int, millionths: int) -> int:
    return (cents * millionths + 500000) // 1000000


def percent_of(cents: int, percent: int) -> int:
    return (cents * percent + 50) // 100


def dollars(c: int) -> str:
    return f"{c // 100:,}" + "." + f"{c % 100:02d}"
