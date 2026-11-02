# The sprout class tests: the new rule is tested alone, without the legacy code.
from morada.step6.limit import MonthlyLimit

LIMIT = MonthlyLimit()


def party_room(unit, date):
    return {"unit": unit, "space": "party-room", "date": date}


def grill(date):
    return {"unit": "A-101", "space": "grill-area", "date": date}


def test_declines_a_second_party_room_booking_in_the_same_month():
    made = [party_room("A-101", "2026-03-14")]
    assert LIMIT.reached(party_room("A-101", "2026-03-28"), made)


def test_does_not_count_another_month_another_unit_or_another_space():
    made = [party_room("A-101", "2026-02-28"), party_room("B-101", "2026-03-14")]
    made.append(grill("2026-03-07"))
    assert not LIMIT.reached(party_room("A-101", "2026-03-28"), made)


def test_grill_area_allows_two_and_space_with_no_limit_allows_all():
    two = [grill("2026-03-07"), grill("2026-03-14")]
    assert not LIMIT.reached(grill("2026-03-21"), two[:1])
    assert LIMIT.reached(grill("2026-03-21"), two)
    pool = {"unit": "A-101", "space": "pool", "date": "2026-03-21"}
    assert not LIMIT.reached(pool, [pool, pool])
