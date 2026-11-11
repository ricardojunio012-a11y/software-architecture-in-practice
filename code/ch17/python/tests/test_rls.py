# Row-Level Security in PostgreSQL: a query with no filter sees only the
# transaction's community, and writing to another community is rejected. The
# management company sees the communities it manages, and only those.
import os
from pathlib import Path

import psycopg
import pytest

from morada.db import as_community, as_management_company, connect

URL = os.environ.get("DATABASE_URL")


@pytest.mark.skipif(not URL, reason="no database")
def test_isolates_reads_and_writes_by_community():
    with connect(URL) as admin:
        admin.execute(Path("/data/sql/schema.sql").read_text(encoding="utf-8"))
        admin.execute(Path("/data/sql/rls.sql").read_text(encoding="utf-8"))
    with connect(os.environ["APP_DATABASE_URL"]) as app:
        query = "SELECT DISTINCT community_id FROM charges"
        rows = as_community(app, 15, lambda: app.execute(query).fetchall())
        assert rows == [(15,)]
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            as_community(
                app,
                15,
                lambda: app.execute(
                    "INSERT INTO charges "
                    "(community_id, unit, resident, amount_cents, status) "
                    "VALUES (20, 'B-1', 'Iris Moore', 61000, 'open')"
                ),
            )


@pytest.mark.skipif(not URL, reason="no database")
def test_a_management_company_sees_only_the_communities_it_manages():
    with connect(URL) as admin:
        admin.execute(Path("/data/sql/schema.sql").read_text(encoding="utf-8"))
        admin.execute(Path("/data/sql/rls.sql").read_text(encoding="utf-8"))
    with connect(os.environ["APP_DATABASE_URL"]) as app:
        query = "SELECT DISTINCT community_id FROM charges ORDER BY 1"
        rows = as_management_company(app, 3, lambda: app.execute(query).fetchall())
        assert rows == [(12,), (15,)]
