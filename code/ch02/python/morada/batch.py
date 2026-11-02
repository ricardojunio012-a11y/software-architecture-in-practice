# Usage: python -m morada.batch <batch.json>
# Simulates the batch invoice queue and compares the time to confirmation with the target.
import json
import sys

from morada.batch_queue import available_by, percentile, simulate


def number(n: int) -> str:
    return f"{n:,}"


def percent(n: float) -> str:
    return f"{n:.2f}%"


# 10 min | 1 h 36 min | never
def duration(seconds: float | None) -> str:
    if seconds is None:
        return "never"
    minutes = round(seconds / 60)
    h = minutes // 60
    if h == 0:
        return f"{minutes} min"
    return f"{h} h" if minutes % 60 == 0 else f"{h} h {minutes % 60} min"


with open(sys.argv[1], encoding="utf-8") as f:
    p = json.load(f)
print(f"{p['id']}: {p['description']} (seed {p['seed']})")
print(
    f"  assumptions: {number(p['invoices'])} invoices in files of "
    f"{number(p['invoicesPerFile'])}, {number(p['invoicesPerSecond'])} per second,"
)
print(
    f"  return file {duration(p['returnSeconds'])} after each file, "
    f"{p['transientFailurePercent']}% transient rejections, "
    f"1 in {p['permanentRejectionEvery']} permanent"
)
print(
    f"  estimate by division: {duration(p['invoices'] / p['invoicesPerSecond'])}  "
    f"target: all within {duration(p['limitSeconds'])}"
)
failures = 0
for adjusted in (False, True):
    r = simulate(p, adjusted)
    within = available_by(r, p["limitSeconds"])
    passed = within == p["invoices"]
    if not passed:
        failures += 1

    def pct(m: int) -> str:
        return duration(percentile(r, p["invoices"], m))

    print("adjusted:" if adjusted else "naive:")
    print(f"  files: {r.files}  creation attempts: {number(r.attempts)}")
    print(
        f"  available at p50: {pct(500)}  p95: {pct(950)}  "
        f"p99: {pct(990)}  p99.9: {pct(999)}"
    )
    print(
        f"  last available: {duration(max(r.available_at))}  never created: "
        f"{number(r.not_created)}  by card: {number(r.via_card)}"
    )
    print(
        f"  within {duration(p['limitSeconds'])}: {number(within)} "
        f"({percent(100 * within / p['invoices'])})"
    )
    print(f"  result: {'PASSED' if passed else 'FAILED'}")
sys.exit(1 if failures else 0)
