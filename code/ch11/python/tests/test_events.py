# Tests: the subscribers are idempotent and independent of each other.
from morada.events import event_for
from morada.modules.communications import Communications
from morada.modules.bookings import Bookings

BOOKING = {"booking": "R-1", "unit": "A-1", "space": "party-room", "date": "2026-03-14"}
EVENT = event_for(
    {"payment": "P-1", "unit": "A-1", "booking": "R-1", "amountCents": 18000}
)


def test_confirm_the_booking_and_notify_the_resident():
    bookings = Bookings([BOOKING])
    communications = Communications()
    bookings.on_payment_confirmed(EVENT)
    communications.on_payment_confirmed(EVENT)
    assert bookings.lines() == ["R-1;A-1;party-room;2026-03-14;confirmed"]
    assert len(communications.notices) == 1


def test_ignore_the_same_event_delivered_twice():
    communications = Communications()
    communications.on_payment_confirmed(EVENT)
    communications.on_payment_confirmed(EVENT)
    assert len(communications.notices) == 1
    assert communications.log[1] == "communications ignored E-P-1 (duplicate)"
