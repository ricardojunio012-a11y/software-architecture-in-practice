# Integration tests of idempotency against PostgreSQL: five simultaneous requests
# with the same key result in a single payment, and all of them get the same
# response; the same key at two management companies is two different requests.
import json
import os
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import psycopg
import pytest

from morada.api.api import create_api, start
from morada.api.db import prepare_database

DB_URL = os.environ.get("DATABASE_URL")


def pay(url: str, company: str, charge: str, amount: int):
    body = json.dumps({"charge": charge, "amountCents": amount}).encode()
    headers = {
        "Content-Type": "application/json",
        "Morada-Management-Company": company,
        "Idempotency-Key": "k-1",
    }
    request = urllib.request.Request(
        f"{url}/v1/payments", data=body, headers=headers, method="POST"
    )
    with urllib.request.urlopen(request) as response:
        return response.status, json.loads(response.read())


def total_payments() -> int:
    with psycopg.connect(DB_URL) as db:
        (total,) = db.execute("SELECT count(*) FROM payments").fetchone()
    return total


@pytest.mark.skipif(not DB_URL, reason="no database")
def test_simultaneous_requests_with_the_same_key_pay_only_once():
    prepare_database(DB_URL, "/data/input/charges.json")
    api = create_api(DB_URL)
    url = start(api)

    def request(_):
        return pay(url, "MC-A", "CH-04", 45000)

    with ThreadPoolExecutor(max_workers=5) as executor:
        responses = list(executor.map(request, range(5)))
    api.shutdown()
    assert [status for status, _ in responses] == [201] * 5
    assert len({body["id"] for _, body in responses}) == 1
    assert total_payments() == 1


@pytest.mark.skipif(not DB_URL, reason="no database")
def test_the_same_key_at_two_management_companies_does_not_collide():
    prepare_database(DB_URL, "/data/input/charges.json")
    api = create_api(DB_URL)
    url = start(api)
    status_a, body_a = pay(url, "MC-A", "CH-04", 45000)
    status_b, body_b = pay(url, "MC-B", "CH-05", 38000)
    api.shutdown()
    assert [status_a, status_b] == [201, 201]
    assert body_a["charge"] == "CH-04"
    assert body_b["charge"] == "CH-05"
    assert total_payments() == 2
