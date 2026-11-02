# Usage: python -m morada.main in-memory|dual-write|outbox <output-folder>
# Billing confirms three payments; Bookings and Communications react to the event.
import json
import sys
from pathlib import Path

from morada.events import event_for
from morada.infra.db import connect_db, save_payment, save_with_outbox
from morada.infra.broker import QUEUES, connect_broker, consume_all, publish
from morada.modules.communications import Communications
from morada.modules.bookings import Bookings

version, out_dir = sys.argv[1], Path(sys.argv[2])
scenario = json.loads(Path("/data/input/scenario.json").read_text("utf-8"))
payments = scenario["payments"]
bookings = Bookings(scenario["bookings"])
communications = Communications()
execution: list[str] = []


# In-memory bus: the subscribers run right away, in the same process
def run_in_memory():
    subscribers = [bookings.on_payment_confirmed, communications.on_payment_confirmed]
    for p in payments:
        e = event_for(p)
        execution.append(f"{p['payment']} confirmed; {e['event']} delivered in memory")
        for subscriber in subscribers:
            subscriber(e)


# The relay reads the outbox and publishes what is pending; it marks it published later
def run_relay(db, channel, crash_before_mark: set[str]):
    rows = db.execute(
        "SELECT id, event, payload FROM outbox WHERE NOT published ORDER BY id"
    ).fetchall()
    for id, event, payload in rows:
        publish(channel, json.loads(payload))
        if event in crash_before_mark:
            crash_before_mark.discard(event)
            execution.append(f"relay published {event} and crashed before marking")
            return
        db.execute("UPDATE outbox SET published = true WHERE id = %s", (id,))
        execution.append(f"relay published {event}")


def run_with_broker(with_outbox: bool):
    db = connect_db()
    channel, connection = connect_broker()
    for p in payments:
        e = event_for(p)
        if with_outbox:
            save_with_outbox(db, p, e)
            execution.append(f"{p['payment']} saved with {e['event']} in the outbox")
            continue
        # Dual write: save to the database, then publish, in two separate steps
        save_payment(db, p)
        if p.get("failure") == "after-write":
            execution.append(
                f"{p['payment']} saved; the process crashed before publishing"
            )
            continue
        publish(channel, e)
        execution.append(f"{p['payment']} saved; {e['event']} published")
    if with_outbox:
        crash = {
            f"E-{p['payment']}"
            for p in payments
            if p.get("failure") == "relay-before-mark"
        }
        run_relay(db, channel, crash)
        run_relay(db, channel, crash)
    consume_all(channel, QUEUES[0], bookings.on_payment_confirmed)
    consume_all(channel, QUEUES[1], communications.on_payment_confirmed)
    connection.close()
    db.close()


if version == "in-memory":
    run_in_memory()
else:
    run_with_broker(version == "outbox")

out_dir.mkdir(parents=True, exist_ok=True)
for name, lines in [
    ("execution.txt", execution),
    ("consumption.txt", bookings.log + communications.log),
    ("result.txt", bookings.lines() + communications.notices),
]:
    (out_dir / name).write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"{version}: output in {out_dir}")
