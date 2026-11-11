# The migrations run once each, in order, and a second run does nothing.
import os

import pytest

from morada.db import connect, reset_schema
from morada.migrations import apply_migrations

URL = os.environ.get("DATABASE_URL")


@pytest.mark.skipif(not URL, reason="no database")
def test_apply_each_file_only_once_in_order():
    with connect(URL) as db:
        reset_schema(db)
        assert apply_migrations(db, "/data/migrations") == [
            "001_charges.sql",
            "002_reserve_fund.sql",
            "003_delinquency_index.sql",
        ]
        assert apply_migrations(db, "/data/migrations") == []
