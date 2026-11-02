# Tests: what the before version cannot test and what the after version isolates.
import json
import os
from datetime import date
from pathlib import Path

from morada.before.issuing import issue_charges
from morada.after.billing.calculator import ChargeCalculator
from morada.after.billing.rules.board_president_exemption import (
    BoardPresidentExemption,
)
from morada.after.billing.rules.early_payment_discount import EarlyPaymentDiscount
from morada.after.billing.rules.monthly_dues import MonthlyDues
from morada.after.billing.rules.past_due_balance import PastDueBalance
from morada.after.billing.rules.reserve_fund import ReserveFund
from morada.after.billing.types import Entry
from morada.after.issuing.gateway import Deadlines, Registration
from morada.after.issuing.issuing_service import IssuingService
from morada.external.alpha_bank import AlphaBankClient

TODAY = date(2026, 3, 2)
DEADLINES = Deadlines(due_date="2026-03-10", discount_until="2026-03-05")


def data():
    # Input: /data/input in the container; outside it, the chapter folder
    file = "/data/input/community.json"
    if not os.path.exists(file):
        file = Path(__file__).parents[2] / "input" / "community.json"
    with open(file, encoding="utf-8") as f:
        return json.load(f)


class InMemoryGateway:
    """Test double: implements the interface and only records what it received."""

    name = "in memory"

    def __init__(self):
        self.received = []

    def register(self, charge, deadlines):
        self.received.append(charge)
        return Registration(charge.unit, "test")


def test_before_calculating_the_charges_also_creates_invoices_at_the_bank():
    before = AlphaBankClient.issued
    issue_charges(data(), TODAY)
    assert AlphaBankClient.issued - before == 8


def test_after_a_new_rule_goes_in_without_changing_the_calculator():
    d = data()

    class ExtraFee:
        def apply(self, unit, posted):
            return [Entry("assessment", "Special assessment", 5000)]

    calculator = ChargeCalculator(
        [MonthlyDues(d["community"]["monthlyExpensesCents"]), ExtraFee()]
    )
    assert calculator.calculate(d["units"][0]).total == 60625 + 5000


def test_after_board_president_is_exempt_from_dues_and_pays_the_reserve():
    d = data()
    calculator = ChargeCalculator(
        [
            MonthlyDues(d["community"]["monthlyExpensesCents"]),
            ReserveFund(10),
            BoardPresidentExemption(),
        ]
    )
    president = next(u for u in d["units"] if u.get("boardPresident"))
    assert calculator.calculate(president).total == 6790


def test_after_a_unit_in_arrears_does_not_get_the_early_payment_discount():
    d = data()
    calculator = ChargeCalculator(
        [
            MonthlyDues(d["community"]["monthlyExpensesCents"]),
            PastDueBalance(),
            EarlyPaymentDiscount(5, DEADLINES.discount_until),
        ]
    )
    by_id = {u["id"]: u for u in d["units"]}
    assert calculator.calculate(by_id["A-101"]).discount == 3031
    assert calculator.calculate(by_id["A-201"]).discount == 0


def test_after_issuing_works_with_any_gateway_without_a_real_bank():
    d = data()
    gateway = InMemoryGateway()
    expenses = d["community"]["monthlyExpensesCents"]
    calculator = ChargeCalculator([MonthlyDues(expenses)])
    before = AlphaBankClient.issued
    IssuingService(calculator, gateway, DEADLINES).issue(d["units"])
    assert len(gateway.received) == 8
    assert AlphaBankClient.issued == before
