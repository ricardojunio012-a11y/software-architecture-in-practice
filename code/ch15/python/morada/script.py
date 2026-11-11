# The "api" version: sets up the database, starts the API, sends the requests in the
# script and checks each response against the contract openapi/v1.yaml.
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

import psycopg

from morada.api.api import create_api, start, to_json
from morada.api.db import prepare_database
from morada.contract.openapi import read_contract
from morada.contract.validate import validate_response

data = Path(sys.argv[1])
output = data / "output" / "api"
db_url = os.environ["DATABASE_URL"]
prepare_database(db_url, str(data / "input" / "charges.json"))
contract = read_contract(str(data / "openapi" / "v1.yaml"))
requests = json.loads((data / "input" / "requests.json").read_text("utf-8"))
api = create_api(db_url)
url = start(api)


def send(r: dict) -> tuple[int, str, dict]:
    headers = {"Content-Type": "application/json"}
    # Who is calling (in place of the access token) and the idempotency key
    if "managementCompany" in r:
        headers["Morada-Management-Company"] = r["managementCompany"]
    if "key" in r:
        headers["Idempotency-Key"] = r["key"]
    body = json.dumps(r["body"]).encode() if "body" in r else None
    request = urllib.request.Request(
        url + r["path"], data=body, headers=headers, method=r["method"]
    )
    try:
        with urllib.request.urlopen(request) as response:
            type = response.headers["Content-Type"]
            return response.status, type, json.loads(response.read())
    except urllib.error.HTTPError as error:
        return error.code, error.headers["Content-Type"], json.loads(error.read())


responses = []
discrepancies = []
for i, r in enumerate(requests, start=1):
    status, type, body = send(r)
    extras = []
    if "managementCompany" in r:
        extras.append(f"Morada-Management-Company: {r['managementCompany']}")
    if "key" in r:
        extras.append(f"Idempotency-Key: {r['key']}")
    listed = f" ({', '.join(extras)})" if extras else ""
    responses += [f"{i}. {r['description']}", f"   {r['method']} {r['path']}{listed}"]
    if "body" in r:
        responses.append(f"   {to_json(r['body'])}")
    responses += [f"   → {status} {type}", f"   {to_json(body)}", ""]
    path = urlsplit(r["path"]).path
    discrepancies += validate_response(contract, r["method"], path, status, type, body)
api.shutdown()

with psycopg.connect(db_url) as db:
    payments = db.execute(
        "SELECT id, charge, amount_cents FROM payments ORDER BY id"
    ).fetchall()
    paid = db.execute(
        "SELECT id FROM charges WHERE status = 'paid' ORDER BY id"
    ).fetchall()
    keys = db.execute("""SELECT management_company, string_agg(key, ', ' ORDER BY key)
           FROM idempotency_keys GROUP BY management_company
           ORDER BY management_company""").fetchall()
state = [f"payments recorded: {len(payments)}"]
state += [f"  {id}: charge {charge}, {amount} cents" for id, charge, amount in payments]
state += [
    f"paid charges: {', '.join(id for (id,) in paid)}",
    "stored idempotency keys:",
]
state += [f"  {company}: {listed}" for company, listed in keys]
check = [f"{len(requests)} responses checked against openapi/v1.yaml"]
check += discrepancies or ["no discrepancies"]

output.mkdir(parents=True, exist_ok=True)
(output / "responses.txt").write_text("\n".join(responses), encoding="utf-8")
(output / "state.txt").write_text("\n".join(state) + "\n", encoding="utf-8")
(output / "contract.txt").write_text("\n".join(check) + "\n", encoding="utf-8")
print(f"api: {len(requests)} requests, {len(discrepancies)} discrepancies")
