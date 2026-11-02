# Tests: what the anemic model allows and what the rich model prevents.
import pytest

from morada.after.domain.error import DomainError
from morada.after.domain.money import Money
from morada.after.domain.schedule import Schedule, UsagePolicy
from morada.after.domain.time_slot import TimeSlot
from morada.before.model import Booking as AnemicBooking
from morada.before.model import bookings

POLICY = UsagePolicy(Money(15000), 2, 1)


def test_before_any_code_can_save_an_overlapping_booking():
    bookings.append(
        AnemicBooking("X-1", space="party-room", date="2026-03-14", start=14, end=22)
    )
    bookings.append(
        AnemicBooking("X-2", space="party-room", date="2026-03-14", start=20, end=23)
    )
    overlapping = [b for b in bookings if b.id.startswith("X-")]
    assert len(overlapping) == 2  # the invalid state was accepted


def test_after_the_schedule_rejects_an_overlapping_time_slot():
    schedule = Schedule("party-room", POLICY)
    schedule.book("R-1", "A-101", TimeSlot("2026-03-14", 14, 22), "2026-03-02")
    with pytest.raises(DomainError, match="time slot overlaps R-1"):
        schedule.book("R-2", "A-202", TimeSlot("2026-03-14", 20, 23), "2026-03-02")


def test_after_there_is_no_time_slot_that_ends_before_it_starts():
    with pytest.raises(DomainError):
        TimeSlot("2026-03-14", 18, 16)


def test_after_money_rounds_half_up_and_is_compared_by_value():
    assert str(Money(18001).percent(50)) == "$90.01"
    assert Money(9000) == Money(9000)


def test_after_a_last_minute_cancellation_yields_a_fee_and_an_event():
    schedule = Schedule("party-room", POLICY)
    schedule.book("R-1", "A-101", TimeSlot("2026-03-14", 14, 22), "2026-03-02")
    schedule.collect_events()
    assert str(schedule.cancel("R-1", "2026-03-13")) == "$90.00"
    assert [type(e).__name__ for e in schedule.collect_events()] == ["BookingCanceled"]
    with pytest.raises(DomainError, match="is not confirmed"):
        schedule.cancel("R-1", "2026-03-13")
    with pytest.raises(DomainError, match="not found"):
        schedule.cancel("R-99", "2026-03-13")
