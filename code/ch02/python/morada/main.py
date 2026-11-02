# Usage: python -m morada.main <scenarios.json>
# Runs each scenario, prints the report and exits with an error if any of them fails.
import json
import sys
from datetime import date

from morada.scenarios import run


def number(n: float) -> str:
    return f"{round(n):,}"


def decimal(n: float, places: int) -> str:
    return f"{n:.{places}f}"


# 2.25 s | 4 min | 6 h 40 min
def duration(seconds: float) -> str:
    if seconds < 60:
        return f"{decimal(seconds, 2)} s"
    minutes = round(seconds / 60)
    h = minutes // 60
    if h == 0:
        return f"{minutes} min"
    return f"{h} h" if minutes % 60 == 0 else f"{h} h {minutes % 60} min"


with open(sys.argv[1], encoding="utf-8") as f:
    scenarios = json.load(f)
today = date(2026, 3, 2)
failures = 0

for s in scenarios:
    r = run(s, today)
    if not r.passed:
        failures += 1
    throughput = r.charges / r.calculation_seconds
    print(f"{s['id']}: {s['description']}")
    print(
        f"  charges: {number(r.charges)}  "
        f"target: within {duration(s['limitSeconds'])}"
    )
    print(
        f"  calculation (measured): {duration(r.calculation_seconds)}, "
        f"{number(throughput)} per second"
    )
    print(
        f"  invoices at the processor (estimated, {s['invoicesPerSecond']}/s): "
        f"{duration(r.processor_seconds)}"
    )
    print(
        f"  notices: {decimal(r.notice_bytes / 1e6, 1)} MB, "
        f"{number(r.notice_bytes / r.charges)} bytes per notice"
    )
    print(f"  result: {'PASSED' if r.passed else 'FAILED'}")
print(f"{len(scenarios) - failures} of {len(scenarios)} scenarios within target.")
sys.exit(1 if failures else 0)
