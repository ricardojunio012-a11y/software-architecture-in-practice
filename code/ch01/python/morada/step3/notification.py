# How the resident learns about the charge.
from dataclasses import dataclass
from typing import Protocol

from morada.step3.calculation import Charge
from morada.step3.period import BillingPeriod
from morada.step3.money import dollars


@dataclass(frozen=True)
class Notice:
    community: str
    period: BillingPeriod
    charge: Charge
    payment_name: str
    payment_code: str


class Notifier(Protocol):
    def notify(self, notice: Notice) -> None: ...


def format_email(notice: Notice) -> str:
    c = notice.charge
    u = c.unit
    lines = [
        f"To: {u['resident']['email']}",
        f"Subject: Monthly dues {notice.period.label} - {notice.community} "
        f"- Unit {u['id']}",
        "",
        f"Hello, {u['resident']['name']}.",
        "",
        f"The monthly dues for {notice.period.label} for unit {u['id']} "
        "are now available.",
        f"Amount: ${dollars(c.total)}",
        f"Due date: {notice.period.due_date}",
    ]
    if c.arrears > 0:
        lines.append(
            f"Includes a past-due balance of ${dollars(c.arrears)}, "
            f"with a late fee of ${dollars(c.late_fee)} "
            f"and interest of ${dollars(c.interest)}."
        )
    lines += [
        f"{notice.payment_name}: {notice.payment_code}",
        "",
        f"{notice.community} Management",
        "----",
    ]
    return "\n".join(lines) + "\n"


# Simulates sending by writing the messages to a file
class EmailToFile:
    def __init__(self, file: str):
        self._file = file
        open(file, "w", encoding="utf-8").close()

    def notify(self, notice: Notice) -> None:
        with open(self._file, "a", encoding="utf-8", newline="\n") as f:
            f.write(format_email(notice))
