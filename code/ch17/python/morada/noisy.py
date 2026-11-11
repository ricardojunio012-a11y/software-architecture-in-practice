# The "noisy" version: a server handles one request at a time, in order of arrival,
# and each request takes serviceMs. With no limit, one community's burst fills the
# queue and delays everyone. With a token bucket per community, the burst is
# rejected (429) and the others barely wait. Time is simulated, and the result is
# always the same.
import json
import sys
from pathlib import Path

from morada.bucket import TokenBucket

data = Path(sys.argv[1])
scenario = json.loads((data / "input" / "noisy.json").read_text("utf-8"))

requests = sorted(
    (t, c["community"])
    for c in scenario["clients"]
    for t in range(c["startMs"], scenario["durationMs"], c["intervalMs"])
)


def simulate(limit: dict | None) -> list[str]:
    rejected: dict[int, int] = {}
    waits: dict[int, list[int]] = {}
    buckets: dict[int, TokenBucket] = {}
    free_at = 0
    for t, community in requests:
        rejected.setdefault(community, 0)
        waits.setdefault(community, [])
        if limit:
            bucket = buckets.setdefault(
                community, TokenBucket(limit["burst"], limit["perSecond"])
            )
            if not bucket.allows(t):
                rejected[community] += 1
                continue
        # The request waits for the server to finish what arrived before it
        start = max(t, free_at)
        waits[community].append(start - t)
        free_at = start + scenario["serviceMs"]
    lines = []
    for community in sorted(waits):
        values = waits[community]
        average = sum(values) // len(values) if values else 0
        maximum = max(values) if values else 0
        lines.append(
            f"community {community}: {len(values) + rejected[community]} requests, "
            f"{len(values)} served, {rejected[community]} rejected, "
            f"average wait {average} ms, max {maximum} ms"
        )
    return lines


limit = scenario["limit"]
result = [
    "== no limit",
    *simulate(None),
    "",
    f"== with a per-community limit (burst of {limit['burst']}, "
    f"{limit['perSecond']} per second)",
    *simulate(limit),
]

output = data / "output" / "noisy"
output.mkdir(parents=True, exist_ok=True)
(output / "result.txt").write_text("\n".join(result) + "\n", encoding="utf-8")
print(f"noisy: {len(requests)} requests simulated")
