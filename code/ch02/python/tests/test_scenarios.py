# Tests of the scenario runner: they check the load and the evaluation, not the time.
from datetime import date

from morada.scenarios import evaluate, run, synthetic_community


def test_creates_the_units_with_shares_that_add_up_to_the_community():
    units = synthetic_community(1, 40)["units"]
    assert len(units) == 40
    assert sum(u["shareMillionths"] for u in units) == 1000000
    assert len([u for u in units if u["pastDue"]]) == 5


def test_passes_within_the_limit_and_fails_above_it():
    assert evaluate(59.9, 60)
    assert not evaluate(60.1, 60)


def test_estimates_invoice_creation_from_the_processor_capacity():
    scenario = {
        "id": "T",
        "description": "test",
        "communities": 3,
        "unitsPerCommunity": 10,
        "invoicesPerSecond": 10,
        "limitSeconds": 2,
    }
    r = run(scenario, date(2026, 3, 2))
    assert r.charges == 30
    assert r.processor_seconds == 3
    assert not r.passed  # 3 s at the processor do not fit in 2 s
