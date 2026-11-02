# Bookings module. Step 4: conditionals and magic numbers (Replace Nested
# Conditional with Guard Clauses, Replace Magic Literal, Replace Loop with Pipeline).
import json
import os
import sys
from datetime import date

MIN_NOTICE_DAYS = 2
SATURDAY_SURCHARGE_PERCENT = 20
GUEST_LIMIT = 50
EXTRA_CLEANING_FEE = 5000  # cents

approved = []
log = []


class Smtp:
    def send(self, to, text):
        log.append("to " + to + ": " + text)


smtp = Smtp()


def days_until(iso_date, today):
    return (date.fromisoformat(iso_date) - today).days


# The original comment said "weekend", but the code only checks Saturday
def is_saturday(iso_date):
    return date.fromisoformat(iso_date).weekday() == 5


def booking_amount(space, request):
    amount = space["fee"]
    if is_saturday(request["date"]):
        amount += amount * SATURDAY_SURCHARGE_PERCENT // 100
    if request["guests"] > GUEST_LIMIT:
        amount += EXTRA_CLEANING_FEE
    return amount


def dollars(cents):
    return f"{cents // 100}.{cents % 100:02d}"


def decline_reason(request, unit, today):
    """Guard clauses: the first rule that fails returns the reason."""
    if unit["inArrears"]:
        return "arrears"
    if days_until(request["date"], today) < MIN_NOTICE_DAYS:
        return "short notice"
    taken = any(
        b["space"] == request["space"] and b["date"] == request["date"]
        for b in approved
    )
    if taken:
        return "conflict"
    return None


def process_bookings(file, dir, today=None, mailer=smtp):
    today = today or date.today()
    data = json.load(open(file, encoding="utf-8"))
    lines = []
    for request in data["requests"]:
        unit = next(u for u in data["units"] if u["id"] == request["unit"])
        space = next(s for s in data["spaces"] if s["id"] == request["space"])
        reason = decline_reason(request, unit, today)
        head = f"{request['id']};{request['unit']};{request['space']};{request['date']}"
        if reason:
            lines.append(f"{head};declined;{reason}")
            mailer.send(unit["email"], f"Booking {request['id']} declined ({reason})")
            continue
        amount = dollars(booking_amount(space, request))
        approved.append(request)
        lines.append(f"{head};approved;{amount}")
        mailer.send(
            unit["email"], f"Booking {request['id']} confirmed. Amount: ${amount}"
        )
    os.makedirs(dir, exist_ok=True)
    open(dir + "/bookings.txt", "w", encoding="utf-8").write("\n".join(lines) + "\n")
    open(dir + "/emails.txt", "w", encoding="utf-8").write("\n".join(log) + "\n")


# Usage: python -m morada.step4.main <input.json> <output-folder> [--today YYYY-MM-DD]
input_file, output, *options = sys.argv[1:]
today = date.fromisoformat(options[1]) if options[:1] == ["--today"] else date.today()
process_bookings(input_file, output, today)
