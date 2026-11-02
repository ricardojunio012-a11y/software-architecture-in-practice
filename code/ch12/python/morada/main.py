# Usage: python -m morada.main monolith|service <output-folder>
# Sends one notice per confirmed payment: through the module, in the same process,
# or through the extracted service, over the network. Counts what happened and
# measures the time of each notice.
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from morada.communications import Communications

version, out_dir = sys.argv[1], Path(sys.argv[2])
notices = json.loads(Path("/data/input/load.json").read_text("utf-8"))["notices"]
url = os.environ.get("COMMUNICATIONS_URL")
count = dict(sent=0, calls=0, errors=0, retries=0, duplicates=0, lost=0)


def post(address: str, body: dict) -> tuple[int, dict]:
    request = urllib.request.Request(
        address,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=2) as response:
            return response.status, json.loads(response.read())
    except urllib.error.HTTPError as error:
        return error.code, {}
    except OSError:
        return 0, {}


# Over the network, each call can fail: try up to 3 times, always with the same id
def send_over_network(id: str, text: str) -> None:
    for attempt in range(1, 4):
        if attempt > 1:
            count["retries"] += 1
            # Growing backoff (5 to 10 ms, then 10 to 20 ms), with jitter, so that
            # clients that failed together do not all come back at the same instant
            cap = 10 * 2 ** (attempt - 2)
            time.sleep((cap / 2 + random.random() * cap / 2) / 1000)
        count["calls"] += 1
        status, body = post(f"{url}/notices", {"id": id, "text": text})
        if status == 200:
            if body["status"] == "duplicate":
                count["duplicates"] += 1
            count["sent"] += 1
            return
        count["errors"] += 1
    count["lost"] += 1


communications = Communications()
if version == "service":
    post(f"{url}/reset", {})
times = []
start = time.perf_counter()
for i in range(1, notices + 1):
    id = f"E-P-{i:03d}"
    text = f"payment {id[2:]} received"
    t0 = time.perf_counter()
    if version == "service":
        send_over_network(id, text)
    elif communications.send(id, text):
        count["sent"] += 1
    times.append((time.perf_counter() - t0) * 1000)
total = (time.perf_counter() - start) * 1000

ordered = sorted(times)
(out_dir / version).mkdir(parents=True, exist_ok=True)
(out_dir / version / "result.txt").write_text(
    f"notices sent: {count['sent']}\n"
    f"network calls: {count['calls']}\n"
    f"error responses: {count['errors']}\n"
    f"retries: {count['retries']}\n"
    f"duplicate notices ignored: {count['duplicates']}\n"
    f"notices lost: {count['lost']}\n",
    encoding="utf-8",
)
# Times vary from machine to machine: they stay out of the verified folder
(out_dir / f"times-{version}.txt").write_text(
    f"mean time per notice: {sum(times) / len(times):.3f} ms\n"
    f"p95 per notice: {ordered[int(len(ordered) * 0.95)]:.3f} ms\n"
    f"worst notice: {ordered[-1]:.3f} ms\n"
    f"total time: {total:.3f} ms\n",
    encoding="utf-8",
)
print(f"{version}: {count['sent']} notices; output in {out_dir / version}")
