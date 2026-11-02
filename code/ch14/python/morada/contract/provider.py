# Provider-side contract verification. Reads the contract the consumer published,
# sets up the state each interaction asks for, sends the request to the real
# Communications API and compares the response with the agreed one.
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

from morada.communications.api import create_api, start
from morada.communications.domain import Communications, InMemoryNotices

out_dir = Path(sys.argv[1])
contract = json.loads((out_dir / "consumer" / "contract.json").read_text("utf-8"))

# Each state in the contract has a setup on the provider side
states = {
    "no notice has been sent": lambda c: None,
    "notice E-P-001 has already been sent": lambda c: c.send(
        "E-P-001", "payment received"
    ),
}


def send(url: str, request: dict) -> dict:
    req = urllib.request.Request(
        url + request["path"],
        data=json.dumps(request["body"]).encode(),
        headers={"Content-Type": "application/json"},
        method=request["method"],
    )
    try:
        with urllib.request.urlopen(req) as response:
            return {"status": response.status, "body": json.loads(response.read())}
    except urllib.error.HTTPError as error:
        return {"status": error.code, "body": json.loads(error.read())}


# The response satisfies the contract if it has the agreed status and the fields
# the consumer declared. Extra fields break no one.
def satisfies(actual: dict, expected: dict) -> bool:
    body = actual["body"]
    return actual["status"] == expected["status"] and all(
        body.get(field) == value for field, value in expected["body"].items()
    )


report = []
for interaction in contract["interactions"]:
    communications = Communications(InMemoryNotices())
    states[interaction["state"]](communications)
    api = create_api(communications)
    actual = send(start(api), interaction["request"])
    api.shutdown()
    if satisfies(actual, interaction["response"]):
        report.append(f"{interaction['description']}: verified")
    else:
        expected = json.dumps(interaction["response"], ensure_ascii=False)
        received = json.dumps(actual, ensure_ascii=False)
        failure = f"FAILED (expected {expected}, received {received})"
        report.append(f"{interaction['description']}: {failure}")

(out_dir / "provider").mkdir(parents=True, exist_ok=True)
(out_dir / "provider" / "report.txt").write_text(
    "\n".join(report) + "\n", encoding="utf-8"
)
print(f"provider: {len(report)} interactions verified")
sys.exit(1 if any("FAILED" in line for line in report) else 0)
