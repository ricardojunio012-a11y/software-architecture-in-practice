# New notification channel: added without touching the email.
from morada.step4.money import dollars
from morada.step4.notification import Notice


def format_sms(notice: Notice) -> str:
    c = notice.charge
    u = c.unit
    text = (
        f"{notice.community}: dues {notice.period.label} for unit {u['id']}: "
        f"${dollars(c.total)}, due {notice.period.due_date}."
    )
    if c.total_by_5th is not None:
        text += f" By {notice.period.discount_deadline}: ${dollars(c.total_by_5th)}."
    text += f" {notice.payment_name}: {notice.payment_code}"
    return f"To: {u['resident']['phone']}\n{text}\n----\n"


# Simulates sending by writing the messages to a file
class SmsToFile:
    def __init__(self, file: str):
        self._file = file
        open(file, "w", encoding="utf-8").close()

    def notify(self, notice: Notice) -> None:
        with open(self._file, "a", encoding="utf-8", newline="\n") as f:
            f.write(format_sms(notice))
