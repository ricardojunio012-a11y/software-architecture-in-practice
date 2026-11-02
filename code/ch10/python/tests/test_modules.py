# Tests: each module tested through its own API, and Bookings tested without Billing.
import pytest

from morada.after.modules.billing.api import Billing
from morada.after.modules.billing.internal.charges_table import ChargesTable
from morada.after.modules.bookings.api import Bookings, RejectionError


class FixedStanding:
    def __init__(self, in_good_standing: bool):
        self.in_good_standing = in_good_standing

    def unit_in_good_standing(self, unit, today):
        return self.in_good_standing


def test_installment_plan_keeps_the_unit_in_good_standing():
    billing = Billing(ChargesTable())
    billing.issue("C-1", "B-101", 58685, "2026-02-10")
    assert not billing.unit_in_good_standing("B-101", "2026-03-02")
    billing.split("C-1", 3)
    assert billing.unit_in_good_standing("B-101", "2026-03-02")


def test_rejects_unit_in_arrears_with_a_fake_billing():
    bookings = Bookings(["party-room"], FixedStanding(False))
    with pytest.raises(RejectionError):
        bookings.book("R-1", "A-1", "party-room", "2026-03-14", "2026-03-02")


def test_does_not_accept_two_bookings_of_the_same_space_on_the_same_day():
    bookings = Bookings(["party-room"], FixedStanding(True))
    bookings.book("R-1", "A-1", "party-room", "2026-03-14", "2026-03-02")
    with pytest.raises(RejectionError, match="party-room already booked on 2026-03-14"):
        bookings.book("R-2", "A-2", "party-room", "2026-03-14", "2026-03-02")
