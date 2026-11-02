# Tests: the Communications module is the same inside and outside the monolith.
from morada.communications import Communications


def test_sends_each_notice_only_once_even_when_asked_again():
    communications = Communications()
    assert communications.send("E-P-001", "payment received")
    assert not communications.send("E-P-001", "payment received")
    assert communications.send("E-P-002", "payment received")
