# Consumer-side contract test. A test double answers exactly what each interaction
# promises; the monolith's real client talks to it. If the client understands every
# response, the interactions become the published contract.
import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

from morada.communications.api import respond, start
from morada.contract.interactions import INTERACTIONS
from morada.monolith.client import CommunicationsClient

out_dir = Path(sys.argv[1])
current: dict = {}


# The provider double: checks the request and returns the agreed response
class Double(BaseHTTPRequestHandler):
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        expected = current["request"]
        same = (
            self.command == expected["method"]
            and self.path == expected["path"]
            and body == expected["body"]
        )
        if same:
            respond(self, current["response"]["status"], current["response"]["body"])
        else:
            respond(self, 500, {"error": "unexpected request"})

    def log_message(self, *args):
        pass


double = HTTPServer(("127.0.0.1", 0), Double)
client = CommunicationsClient(start(double))

# What the monolith must understand from each response
expected = {
    "sending a new notice": {"ok": True, "duplicate": False},
    "resending a notice already sent": {"ok": True, "duplicate": True},
    "notice without text": {"ok": False, "error": "text is required"},
}

report = []
for interaction in INTERACTIONS:
    current = interaction
    body = interaction["request"]["body"]
    result = client.send(body["id"], body["text"])
    ok = result == expected[interaction["description"]]
    report.append(
        f"{interaction['description']}: {'the client understood' if ok else 'FAILED'}"
    )
double.shutdown()

contract = {
    "consumer": "monolith",
    "provider": "communications",
    "interactions": INTERACTIONS,
}
(out_dir / "consumer").mkdir(parents=True, exist_ok=True)
(out_dir / "consumer" / "contract.json").write_text(
    json.dumps(contract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
(out_dir / "consumer" / "report.txt").write_text(
    "\n".join(report) + "\n", encoding="utf-8"
)
print(f"consumer: {len(INTERACTIONS)} interactions in the contract")
