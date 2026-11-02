# Usage: python -m morada.contacts <output-folder>
# The hard part of the extraction. To send a notice, Communications needs the
# resident's email, which belongs to the Directory and, in the monolith, came from
# a join with its table. Outside the monolith, with no shared table, there are two
# paths: query the Directory through its API on every notice, or keep a replica of
# the contacts, fed by the ContactChanged events. A simulated clock, in minutes,
# keeps the output the same on any machine.
import json
import sys
from pathlib import Path

scenario = json.loads(Path("/data/input/contacts.json").read_text("utf-8"))
changes = scenario["changes"]
start, end = scenario["directoryDown"]["from"], scenario["directoryDown"]["to"]
lag = scenario["replicaLag"]
out_dir = Path(sys.argv[1])


def unit_of(notice: int) -> str:
    return f"U-{(notice - 1) % scenario['units'] + 1:02d}"


def directory_up(minute: int) -> bool:
    return minute < start or minute > end


# A unit's email at a given minute, counting the changes already in effect
def email_at(unit: str, minute: int, copy_lag: int = 0) -> str:
    email = f"resident.{unit.lower().replace('-', '')}@example.com"
    for c in changes:
        if c["unit"] == unit and c["minute"] + copy_lag <= minute:
            email = c["email"]
    return email


# Path 1: on every notice, ask the Directory for the email. If it does not answer,
# the notice waits in a local queue and goes out when the Directory comes back.
def by_lookup() -> list[str]:
    calls = errors = right_away = longest_delay = 0
    held: list[int] = []
    for notice in range(1, scenario["notices"] + 1):
        minute = notice
        if directory_up(minute):
            for queued in held:
                calls += 1
                longest_delay = max(longest_delay, minute - queued)
            held = []
        calls += 1
        if not directory_up(minute):
            errors += 1
            held.append(minute)
            continue
        right_away += 1
    return [
        "Querying the Directory API on every notice",
        f"  calls to the Directory: {calls} ({errors} failed)",
        f"  notices sent right away: {right_away}",
        f"  notices held until the Directory came back: {errors} "
        f"(longest delay: {longest_delay} min)",
        # Each lookup reads the current email: no notice goes to an old address
        "  notices sent to an outdated email: 0",
    ]


# Path 2: Communications keeps a copy of the contacts, loaded once and updated by
# the events, which arrive a few minutes after the change
def by_replica() -> list[str]:
    outdated = []
    for notice in range(1, scenario["notices"] + 1):
        unit = unit_of(notice)
        if email_at(unit, notice, lag) == email_at(unit, notice):
            continue
        c = [x for x in changes if x["unit"] == unit and x["minute"] <= notice][-1]
        outdated.append(
            f"    E-P-{notice:03d} to {unit}: old email "
            f"(changed at minute {c['minute']}; in the replica, at {c['minute'] + lag})"
        )
    applied = [c for c in changes if c["minute"] + lag <= scenario["notices"]]
    return [
        f"Contacts replica fed by events (lag of {lag} min)",
        f"  initial load: {scenario['units']} contacts",
        f"  ContactChanged events applied: {len(applied)}",
        "  calls to the Directory: 0",
        f"  notices sent right away: {scenario['notices']}",
        "  notices held until the Directory came back: 0",
        f"  notices sent to an outdated email: {len(outdated)}",
        *outdated,
    ]


(out_dir / "contacts").mkdir(parents=True, exist_ok=True)
lines = [*by_lookup(), "", *by_replica()]
(out_dir / "contacts" / "result.txt").write_text("\n".join(lines) + "\n", "utf-8")
print(f"contacts: output in {out_dir / 'contacts'}")
