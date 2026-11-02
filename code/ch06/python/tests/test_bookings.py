# Characterization tests: they describe what the code does today, including what
# may be wrong. Changing the behavior is another step, with another commit.
import json
import os
from datetime import date
from pathlib import Path

from morada.step5.bookings import decide, decline_reason, notices, report
from morada.step5.bookings import booking_amount

TODAY = date(2026, 3, 2)
PARTY_ROOM = {"id": "party-room", "name": "Party room", "fee": 15000}


def read(folder, file):
    # Input and approved result: /data in the container; outside it, the chapter folder
    base = Path(f"/data/{folder}")
    if not base.exists():
        base = Path(__file__).parents[2] / folder
    return (base / file).read_text(encoding="utf-8")


def test_the_output_is_identical_to_the_approved_result():
    decisions = decide(json.loads(read("input", "bookings.json")), TODAY)
    emails = [f"to {to}: {text}" for to, text in notices(decisions)]
    assert "\n".join(report(decisions)) + "\n" == read("expected", "bookings.txt")
    assert "\n".join(emails) + "\n" == read("expected", "emails.txt")


def test_sunday_has_no_weekend_surcharge_current_behavior():
    sunday = {"id": "R", "unit": "A", "space": "party-room", "date": "2026-03-15"}
    sunday["guests"] = 1
    assert booking_amount(PARTY_ROOM, sunday) == 15000
    assert booking_amount(PARTY_ROOM, {**sunday, "date": "2026-03-14"}) == 18000


def test_the_first_rule_that_fails_decides_the_reason():
    request = {"id": "R", "unit": "A", "space": "party-room", "date": "2026-03-03"}
    in_arrears = {"id": "A", "email": "a@x.com", "inArrears": True}
    assert decline_reason(request, in_arrears, TODAY, []) == "arrears"
    up_to_date = {**in_arrears, "inArrears": False}
    assert decline_reason(request, up_to_date, TODAY, []) == "short notice"
