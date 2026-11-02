# Unit tests: the service's rule, with no network and no database. They run in
# milliseconds.
import pytest

from morada.communications.domain import (
    Communications,
    InMemoryNotices,
    InvalidDataError,
)


def test_sends_a_new_notice():
    communications = Communications(InMemoryNotices())
    assert communications.send("E-1", "payment received") == "sent"


def test_recognizes_a_duplicate_notice():
    communications = Communications(InMemoryNotices())
    communications.send("E-1", "payment received")
    assert communications.send("E-1", "payment received") == "duplicate"


def test_rejects_a_notice_without_text():
    with pytest.raises(InvalidDataError):
        Communications(InMemoryNotices()).send("E-1", "")
