# End-to-end test: the monolith's client, the real API and PostgreSQL together.
# Few, slow and valuable: they prove the pieces were wired correctly.
import os

import pytest

from morada.communications.api import create_api, start
from morada.communications.domain import Communications
from morada.communications.postgres import PostgresNotices
from morada.monolith.client import CommunicationsClient


@pytest.mark.skipif(not os.environ.get("DATABASE_URL"), reason="no database")
def test_sends_the_notice_once_and_recognizes_the_resend():
    notices = PostgresNotices.connect(os.environ["DATABASE_URL"])
    api = create_api(Communications(notices))
    client = CommunicationsClient(start(api))
    assert client.send("E-1", "payment received") == {"ok": True, "duplicate": False}
    assert client.send("E-1", "payment received") == {"ok": True, "duplicate": True}
    api.shutdown()
    notices.close()
