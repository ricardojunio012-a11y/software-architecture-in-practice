# Usage: python -m morada.after.main <commands.json> <output-folder>
# Assembles the repository and the application service and runs the commands in order.
import json
import os
import sys

from morada.after.application.booking_service import BookingService
from morada.after.application.repository import InMemorySchedules
from morada.after.domain.events import BookingConfirmed
from morada.after.domain.money import Money
from morada.after.domain.schedule import UsagePolicy

input_path, output = sys.argv[1:3]
with open(input_path, encoding="utf-8") as f:
    data = json.load(f)
policies = {
    s["id"]: UsagePolicy(Money(s["feeCents"]), s["minNoticeDays"], s["monthlyLimit"])
    for s in data["spaces"]
}

events = []


def publish(e):
    if isinstance(e, BookingConfirmed):
        line = f"{e.booking};{e.space};{e.slot};{e.unit};{e.fee}"
    else:
        fee = e.cancellation_fee
        detail = f"cancellation fee {fee}" if fee.cents else "no cancellation fee"
        line = f"{e.booking};{detail}"
    events.append(f"{type(e).__name__};{line}")


schedules = InMemorySchedules(policies)
service = BookingService(schedules, publish)
results = []
for c in data["commands"]:
    r = service.execute(c)
    results.append(f"{r.booking};{r.command};{r.status};{r.detail}")
schedule = [
    f"{s.space};{b.id};{b.slot};{b.unit}" for s in schedules.all() for b in s.active()
]

os.makedirs(output, exist_ok=True)
for name, lines in (
    ("results", results),
    ("events", events),
    ("schedule", schedule),
):
    with open(os.path.join(output, f"{name}.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
print(f"{len(results)} commands executed; output in {output}")
