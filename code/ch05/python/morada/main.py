# Usage: python -m morada.main <input.json> <output-folder> [--today YYYY-MM-DD]
# Assembles the objects and processes the booking requests in the order they arrived.
import json
import os
import sys
from datetime import date

from morada.approval import (
    MinimumNotice,
    MonthlyLimit,
    SpaceAvailable,
    UnitInGoodStanding,
)
from morada.events import EventBus
from morada.notification import ChannelFactory, SimulatedProvider
from morada.race import race
from morada.repository import InMemoryRepository
from morada.service import BookingService
from morada.subscribers import ChargeUsageFee, NotifyFrontDesk, NotifyResident
from morada.types import BookingRequest, Resident, Space, Unit

input, output, *options = sys.argv[1:]
today = date.fromisoformat(options[1]) if options[:1] == ["--today"] else date.today()
with open(input, encoding="utf-8") as f:
    data = json.load(f)
spaces = {
    s["id"]: Space(
        s["id"], s["name"], s["feeCents"], s["minNoticeDays"], s["monthlyLimit"]
    )
    for s in data["spaces"]
}
units = {
    u["id"]: Unit(u["id"], u["inArrears"], Resident(**u["resident"]))
    for u in data["units"]
}


def build_approval(bookings):
    approval = UnitInGoodStanding()
    approval.and_then(MinimumNotice(today)).and_then(SpaceAvailable(bookings)).and_then(
        MonthlyLimit(bookings)
    )
    return approval


bookings = InMemoryRepository()
approval = build_approval(bookings)

provider = SimulatedProvider(data["simulatedFailures"], data["invalidDestinations"])
notifications, fees, front_desk, waits = [], [], [], []


def wait(ms: int, who: str) -> None:
    """Simulated clock: records the wait instead of really waiting."""
    waits.append(f"{who}: wait {ms} ms")


factory = ChannelFactory(provider, notifications, wait)
events = EventBus()
events.subscribe("BookingConfirmed", ChargeUsageFee(fees))
events.subscribe("BookingConfirmed", NotifyFrontDesk(front_desk))
events.subscribe("BookingConfirmed", NotifyResident(factory))
events.subscribe("BookingRejected", NotifyResident(factory))

service = BookingService(approval, bookings, events)
decisions = []
for r in data["requests"]:
    request = BookingRequest(r["id"], units[r["unit"]], spaces[r["space"]], r["date"])
    d = service.submit(request)
    result = "approved" if d.approved else f"rejected;{d.reason}"
    decisions.append(f"{r['id']};{r['unit']};{r['space']};{r['date']};{result}")

# State: canceling depends on the state the booking is in
cancellations = []
for id in data["cancellations"]:
    try:
        cancellations.append(f"{id};{service.cancel(id)}")
    except ValueError as error:
        cancellations.append(f"{id};error;{error}")


# Now the hard part: two requests at the same time for the same space and date
def build():
    fresh = InMemoryRepository()
    return build_approval(fresh), fresh


simultaneous = [
    BookingRequest(r["id"], units[r["unit"]], spaces[r["space"]], r["date"])
    for r in data["simultaneousRequests"]
]
concurrency = race(simultaneous, build)

files = {
    "bookings": decisions,
    "notifications": notifications,
    "sent": provider.delivered,
    "fees": fees,
    "front-desk": front_desk,
    "failures": events.failures,
    "waits": waits,
    "cancellations": cancellations,
    "concurrency": concurrency,
}
os.makedirs(output, exist_ok=True)
for name, lines in files.items():
    with open(os.path.join(output, f"{name}.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
print(f"{len(decisions)} requests processed; output in {output}")
