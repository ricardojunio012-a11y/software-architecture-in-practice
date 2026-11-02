# Tests: each pattern in isolation, with test doubles in place of the providers.
from datetime import date

import pytest

from morada.approval import MinimumNotice, UnitInGoodStanding
from morada.events import Event, EventBus
from morada.notification import (
    ChannelFactory,
    Email,
    Message,
    SimulatedProvider,
    Sms,
    WithLogging,
    WithRetries,
)
from morada.repository import InMemoryRepository
from morada.state import Booking
from morada.types import BookingRequest, Decision, Resident, Space, Unit

RESIDENT = Resident("David", "d@x.com", "sms", "+1")
REQUEST = BookingRequest(
    "R-1",
    Unit("A-1", False, RESIDENT),
    Space("party-room", "Party room", 15000, 2, 1),
    "2026-03-03",
)
MESSAGE = Message("Test", "hello")


def test_decorator_retries_outside_and_logging_inside():
    provider = SimulatedProvider({"+1": 2})
    log, waits = [], []
    channel = WithRetries(
        WithLogging(Sms(provider), log), 3, lambda ms, who: waits.append(ms)
    )
    channel.send(RESIDENT, MESSAGE)
    assert log == [
        "sms to David: failed (provider unavailable)",
        "sms to David: failed (provider unavailable)",
        "sms to David: delivered (Test)",
    ]
    assert waits == [100, 200]  # growing wait


def test_decorator_permanent_failure_is_not_retried():
    provider = SimulatedProvider({}, ["d@x.com"])
    log = []
    channel = WithRetries(WithLogging(Email(provider), log), 3, lambda ms, who: None)
    with pytest.raises(RuntimeError, match="without retry"):
        channel.send(RESIDENT, MESSAGE)
    assert len(log) == 1


def test_state_the_booking_accepts_only_its_state_transitions():
    booking = Booking(REQUEST)
    booking.approve()
    booking.cancel()
    assert booking.state == "canceled"
    with pytest.raises(ValueError, match="cannot approve a canceled booking"):
        booking.approve()


def test_repository_save_if_free_rejects_the_second_request():
    bookings = InMemoryRepository()
    first = Booking(REQUEST)
    assert bookings.save_if_free(first)
    first.approve()
    second = BookingRequest("R-2", REQUEST.unit, REQUEST.space, REQUEST.date)
    assert not bookings.save_if_free(Booking(second))


def test_factory_picks_by_channel_and_falls_back_to_email():
    factory = ChannelFactory(SimulatedProvider({}), [], lambda ms, who: None)
    assert factory.for_resident(RESIDENT).name == "sms"
    pigeon = Resident("David", "d@x.com", "carrier-pigeon", "+1")
    assert factory.for_resident(pigeon).name == "email"


def test_chain_the_first_stage_that_rejects_decides_the_reason():
    chain = UnitInGoodStanding()
    chain.and_then(MinimumNotice(date(2026, 3, 2)))
    in_arrears = BookingRequest(
        "R-1", Unit("A-1", True, RESIDENT), REQUEST.space, REQUEST.date
    )
    assert chain.evaluate(in_arrears).reason == "unit in arrears"
    assert chain.evaluate(REQUEST).reason == "minimum notice of 2 days"
    later = BookingRequest("R-1", REQUEST.unit, REQUEST.space, "2026-03-10")
    assert chain.evaluate(later) == Decision(True)


def test_observer_a_failing_subscriber_does_not_stop_the_others():
    events = EventBus()
    received = []

    class Broken:
        name = "Broken"

        def handle(self, event):
            raise RuntimeError("out of service")

    class FrontDesk:
        name = "FrontDesk"

        def handle(self, event):
            received.append(event.request.id)

    events.subscribe("BookingConfirmed", Broken())
    events.subscribe("BookingConfirmed", FrontDesk())
    events.publish(Event("BookingConfirmed", REQUEST))
    assert received == ["R-1"]
    assert events.failures == ["BookingConfirmed R-1: Broken: out of service"]
