# Amounts always in cents (integers), so no precision is lost.
# Rounding: half a cent rounds up.


def share_of(cents: int, millionths: int) -> int:
    return (cents * millionths + 500000) // 1000000


def percent_of(cents: int, percent: int) -> int:
    return (cents * percent + 50) // 100


# 123456 -> "1,234.56"
def dollars(cents: int) -> str:
    return f"{cents // 100:,}" + "." + f"{cents % 100:02d}"
