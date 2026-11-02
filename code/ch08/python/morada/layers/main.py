# Usage: python -m morada.layers.main <requests.json> <output-folder>
# Assembles the layers from the bottom up and sends the requests to the API, in memory
# (without opening a port), writing each response.
import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient

from morada.layers.application import BookingService
from morada.layers.data import ScheduleRepository
from morada.layers.domain import Space
from morada.layers.presentation import create_api

input_file, output = sys.argv[1], Path(sys.argv[2])
data = json.loads(Path(input_file).read_text(encoding="utf-8"))
spaces = [Space(s["id"], s["feeCents"], s["minNoticeDays"]) for s in data["spaces"]]
api = TestClient(create_api(BookingService(ScheduleRepository(spaces))))

lines = []
for r in data["requests"]:
    response = api.request(r["method"], r["path"], json=r.get("body"))
    body = json.dumps(response.json(), ensure_ascii=False, separators=(",", ":"))
    lines.append(f"{r['method']} {r['path']} -> {response.status_code} {body}")

output.mkdir(parents=True, exist_ok=True)
(output / "responses.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"{len(lines)} requests; output in {output}")
