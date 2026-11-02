# Usage: python -m morada.main online|offline|restart|persisted <output-folder>
# Simulates a morning at the front desk with two tablets. In the offline version,
# tablet A loses the internet, works from the local queue, and syncs when it comes back.
import json
import sys
from pathlib import Path

from morada.backend import Bookings, FrontDesk
from morada.bff import StaffBff
from morada.tablet import Tablet

version, output = sys.argv[1], Path(sys.argv[2])
scenario = json.loads(Path("/data/input/scenario.json").read_text("utf-8"))
front_desk = FrontDesk(scenario["packages"])
bookings = Bookings(scenario["guests"])
# In the persisted version, the result of each operation goes to a table that
# outlives the BFF process; in the others, it lives only in the BFF's memory
operations_table: dict[str, str] = {}


def new_bff() -> StaffBff:
    store = operations_table if version == "persisted" else {}
    return StaffBff(front_desk, bookings, store)


bff = new_bff()
log: list[str] = []
tablets = {name: Tablet(name, lambda: bff, log) for name in ("A", "B")}

for step in scenario["steps"]:
    if version not in step.get("only", [version]):
        continue
    action = step["action"]
    if action == "restartBff":
        bff = new_bff()
        log.append("the BFF restarted: what was only in its memory is gone")
        continue
    tablet = tablets[step["tablet"]]
    if action == "open":
        tablet.open()
    elif action == "disconnect":
        tablet.disconnect()
    elif action == "reconnect":
        tablet.reconnect(step["loseResponse"])
    elif action == "resend":
        tablet.resend()
    else:
        data = {k: v for k, v in step.items() if k not in ("tablet", "action")}
        tablet.operate({"type": action, **data})

state = [
    (
        f"{p['id']} {p['unit']}: {p['status']} by tablet {p['by']} at {p['time']}"
        if "by" in p
        else f"{p['id']} {p['unit']}: {p['status']}"
    )
    for p in front_desk.packages.values()
]
state += [
    f"{v['name']} ({v['booking']}) entered at {v['time']} on tablet {v['tablet']}"
    for v in front_desk.visitors
]
state.append(f"repeated operations ignored: {bff.repeated}")

(output / version).mkdir(parents=True, exist_ok=True)
(output / version / "log.txt").write_text("\n".join(log) + "\n", "utf-8")
(output / version / "state.txt").write_text("\n".join(state) + "\n", "utf-8")
print(f"{version}: output in {output / version}")
