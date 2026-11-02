# The month's charge report, for the management company.
from morada.step4.calculation import Charge
from morada.step4.period import BillingPeriod
from morada.step4.money import dollars


class ChargeReport:
    def __init__(self, community: str, period: BillingPeriod):
        self._lines = [
            f"# Charges {period.label} - {community} - " f"due {period.due_date}",
            "unit;resident;dues;reserve;arrears;late_fee;interest;total;"
            "total_by_5th;payment",
        ]

    def add(self, c: Charge, payment_code: str) -> None:
        values = [
            dollars(v)
            for v in (c.dues, c.reserve, c.arrears, c.late_fee, c.interest, c.total)
        ]
        discounted = "-" if c.total_by_5th is None else dollars(c.total_by_5th)
        self._lines.append(
            ";".join(
                [
                    c.unit["id"],
                    c.unit["resident"]["name"],
                    *values,
                    discounted,
                    payment_code,
                ]
            )
        )

    def save(self, file: str) -> None:
        with open(file, "w", encoding="utf-8", newline="\n") as f:
            f.write("\n".join(self._lines) + "\n")
