# Bookings module. Step 3: names that say what things are and extracted
# functions (Rename Variable, Extract Function). The structure is still the original.
import json
import os
import sys
from datetime import date

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
        amount = amount + amount * 20 // 100
    if request["guests"] > 50:
        amount = amount + 5000
    return amount


def dollars(cents):
    return f"{cents // 100}.{cents % 100:02d}"


def process_bookings(file, dir, today=None, mailer=smtp):
    today = today or date.today()
    data = json.load(open(file, encoding="utf-8"))
    lines = []
    for request in data["requests"]:
        unit = [u for u in data["units"] if u["id"] == request["unit"]][0]
        space = [s for s in data["spaces"] if s["id"] == request["space"]][0]
        accepted = True
        reason = ""
        if unit["inArrears"]:
            accepted = False
            reason = "arrears"
        else:
            if days_until(request["date"], today) < 2:
                accepted = False
                reason = "short notice"
            else:
                for booking in approved:
                    if (
                        booking["space"] == request["space"]
                        and booking["date"] == request["date"]
                    ):
                        accepted = False
                        reason = "conflict"
        head = f"{request['id']};{request['unit']};{request['space']};{request['date']}"
        if accepted:
            amount = dollars(booking_amount(space, request))
            approved.append(request)
            lines.append(f"{head};approved;{amount}")
            mailer.send(
                unit["email"],
                f"Booking {request['id']} confirmed. Amount: ${amount}",
            )
        else:
            lines.append(f"{head};declined;{reason}")
            mailer.send(unit["email"], f"Booking {request['id']} declined ({reason})")
    os.makedirs(dir, exist_ok=True)
    open(dir + "/bookings.txt", "w", encoding="utf-8").write("\n".join(lines) + "\n")
    open(dir + "/emails.txt", "w", encoding="utf-8").write("\n".join(log) + "\n")


# Usage: python -m morada.step3.main <input.json> <output-folder> [--today YYYY-MM-DD]
input_file, output, *options = sys.argv[1:]
today = date.fromisoformat(options[1]) if options[:1] == ["--today"] else date.today()
process_bookings(input_file, output, today)
