# Usage: python -m morada.main.http memory|postgres <output-folder>
# Starts the HTTP adapter with the chosen repository, sends the requests
# in memory and writes the responses and the final state of the schedules.
import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient

from morada.adapters.inbound.http import create_api
from morada.domain.schedule import slot
from morada.main.assemble import assemble

repository, output = sys.argv[1], Path(sys.argv[2])
service, schedules = assemble(repository, prepare=True)
api = TestClient(create_api(service))
data = json.loads(Path("/data/input/requests.json").read_text("utf-8"))

lines = []
for r in data["requests"]:
    response = api.request(r["method"], r["path"], json=r.get("body"))
    body = json.dumps(response.json(), ensure_ascii=False, separators=(",", ":"))
    lines.append(f"{r['method']} {r['path']} -> {response.status_code} {body}")
state = [
    f"{s.space.id};{b.id};{b.unit};{slot(b)}"
    for s in schedules.all()
    for b in s.bookings()
]

output.mkdir(parents=True, exist_ok=True)
(output / "responses.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
(output / "schedules.txt").write_text("\n".join(state) + "\n", encoding="utf-8")
print(f"{len(lines)} requests ({repository}); output in {output}")
