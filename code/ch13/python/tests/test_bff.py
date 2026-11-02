# Tests: the home screen in one call, the idempotent batch, and the detected conflict.
from morada.backend import Bookings, FrontDesk
from morada.bff import StaffBff

DELIVER = {
    "id": "op-A1",
    "type": "deliver",
    "packageId": "P-1",
    "seenVersion": 1,
    "time": "09:00",
}


def build():
    return StaffBff(
        FrontDesk([{"id": "P-1", "unit": "A-1"}]),
        Bookings([{"booking": "R-1", "space": "party-room", "names": ["Anna"]}]),
    )


def test_builds_the_home_screen_in_one_call():
    screen = build().home()
    assert screen["pendingPackages"] == [{"id": "P-1", "unit": "A-1", "version": 1}]
    assert [v["name"] for v in screen["expectedVisitors"]] == ["Anna"]


def test_does_not_mistake_a_visitor_for_another_whose_name_contains_theirs():
    bff = StaffBff(
        FrontDesk([]),
        Bookings(
            [{"booking": "R-1", "space": "party-room", "names": ["Anna", "Mary Anna"]}]
        ),
    )
    visit = {"id": "op-A1", "type": "registerVisitor", "name": "Mary Anna"}
    bff.sync("A", [{**visit, "booking": "R-1", "time": "09:00"}])
    assert [v["name"] for v in bff.home()["expectedVisitors"]] == ["Anna"]


def test_with_persisted_results_recognizes_the_batch_after_a_restart():
    front_desk = FrontDesk([{"id": "P-1", "unit": "A-1"}])
    bookings = Bookings([])
    table: dict[str, str] = {}
    StaffBff(front_desk, bookings, table).sync("A", [DELIVER])
    after = StaffBff(front_desk, bookings, table)
    [(_, result)] = after.sync("A", [DELIVER])
    assert result == "applied"
    assert after.repeated == 1


def test_does_not_apply_a_resent_batch_twice():
    bff = build()
    bff.sync("A", [DELIVER])
    [(_, result)] = bff.sync("A", [DELIVER])
    assert result == "applied"
    assert bff.repeated == 1


def test_reports_a_conflict_when_the_package_changed():
    bff = build()
    bff.sync("B", [{**DELIVER, "id": "op-B1", "type": "return"}])
    [(_, result)] = bff.sync("A", [DELIVER])
    assert result == "conflict: P-1 already returned by tablet B at 09:00"
