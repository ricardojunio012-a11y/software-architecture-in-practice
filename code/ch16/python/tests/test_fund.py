# The reserve fund: formatting in dollars, and two simultaneous withdrawals with the
# fund row locked, which never leave the balance negative.
import os
from concurrent.futures import ThreadPoolExecutor

import pytest

from morada.db import connect, reset_schema
from morada.fund import balance, dollars, record_withdrawal, set_up_fund
from morada.migrations import apply_migrations

URL = os.environ.get("DATABASE_URL")


def test_dollars_formats_cents_with_thousands_separator_and_sign():
    assert dollars(100000) == "$1,000.00"
    assert dollars(-30000) == "-$300.00"
    assert dollars(5) == "$0.05"


@pytest.mark.skipif(not URL, reason="no database")
def test_simultaneous_withdrawals_with_the_fund_locked_never_go_negative():
    with connect(URL) as db:
        reset_schema(db)
        apply_migrations(db, "/data/migrations")
        set_up_fund(db)

        def withdraw(request):
            amount, description = request
            with connect(URL) as connection:
                return record_withdrawal(connection, 1, amount, description)

        requests = [(70000, "gate repair"), (60000, "facade painting")]
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(withdraw, requests))
        assert results.count(True) == 1
        assert balance(db, 1) >= 0
