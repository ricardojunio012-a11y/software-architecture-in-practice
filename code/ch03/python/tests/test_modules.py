# Tests: the hidden coupling of "before" and the isolation of "after".
import json
import os
from datetime import date
from pathlib import Path

import morada.before.services.services as services
from morada.after.charges import calculate_charges
from morada.after.delinquency import delinquency_report
from morada.before.config.config import config

TODAY = date(2026, 3, 2)


def data():
    # Input: /data/input in the container; outside it, the chapter folder
    file = "/data/input/billing.json"
    if not os.path.exists(file):
        file = Path(__file__).parents[2] / "input" / "billing.json"
    with open(file, encoding="utf-8") as f:
        return json.load(f)


def test_before_delinquency_reorders_another_modules_charges():
    config.today, config.data = TODAY, data()
    services.calculate_all()
    original_order = [c["unit"]["id"] for c in services.charges]
    services.generate_output("delinquency")
    assert [c["unit"]["id"] for c in services.charges] != original_order


def test_after_delinquency_does_not_change_the_charges():
    d = data()
    charges = calculate_charges(
        d["community"]["monthlyExpensesCents"], d["units"], TODAY
    )
    before = [c.unit for c in charges]
    delinquency_report("Test", TODAY, charges)
    assert [c.unit for c in charges] == before


def test_after_calculates_late_charges_without_global_configuration():
    (carol,) = calculate_charges(485000, [data()["units"][2]], TODAY)
    assert (carol.days_late, carol.late_fee, carol.interest) == (20, 1335, 445)
