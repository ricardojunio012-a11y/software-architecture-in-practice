# Integration tests: the repository against a real PostgreSQL, in a container.
import os

import psycopg
import pytest

from morada.communications.postgres import PostgresNotices

pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"), reason="no database"
)


def test_records_a_notice_and_finds_it_later():
    notices = PostgresNotices.connect(os.environ["DATABASE_URL"])
    assert not notices.already_sent("E-1")
    notices.record("E-1", "payment received")
    assert notices.already_sent("E-1")
    notices.close()


def test_the_database_rejects_the_same_notice_twice():
    notices = PostgresNotices.connect(os.environ["DATABASE_URL"])
    notices.record("E-1", "payment received")
    with pytest.raises(psycopg.errors.UniqueViolation):
        notices.record("E-1", "payment received")
    notices.close()
