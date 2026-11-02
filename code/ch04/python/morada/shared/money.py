# Amounts in cents and half-up rounding.


def share_of(cents: int, millionths: int) -> int:
    return (cents * millionths + 500000) // 1000000


def percent_of(cents: int, percent: int) -> int:
    return (cents * percent + 50) // 100


def dollars(c: int) -> str:
    """1,352.18 (US format, with a sign when negative)"""
    a = abs(c)
    return ("-" if c < 0 else "") + f"{a // 100:,}.{a % 100:02d}"


def plain_dollars(c: int) -> str:
    """1352.18 (the format the Alpha Bank API asks for)"""
    return f"{c // 100}.{c % 100:02d}"
