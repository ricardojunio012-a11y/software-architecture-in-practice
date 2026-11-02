# Unit tests for step 3: possible because the calculation was separated from the rest.
from datetime import date

from morada.step3.application import generate_billing
from morada.step3.calculation import calculate_charge
from morada.step3.payment import Invoice

TODAY = date(2026, 3, 2)


def unit(**extra):
    return {
        "id": "A-101",
        "shareMillionths": 125000,
        "resident": {"name": "Anna", "email": "anna@example.com", "channel": "email"},
        "paymentMethod": "invoice",
        "pastDue": None,
        **extra,
    }


def test_splits_expenses_by_share_and_adds_reserve_fund():
    c = calculate_charge(485000, unit(), TODAY)
    assert (c.dues, c.reserve, c.total) == (60625, 6063, 66688)


def test_charges_late_fee_and_interest_prorated_by_days_late():
    c = calculate_charge(
        485000,
        unit(pastDue={"amountCents": 66750, "dueDate": "2026-02-10"}),
        TODAY,
    )
    assert c.late_fee == 1335
    assert c.interest == 445  # 20 days
    assert c.total == 66688 + 66750 + 1335 + 445


def test_notifies_each_resident_once_without_sending_anything():
    class FakeNotifier:
        def __init__(self):
            self.notices = []

        def notify(self, notice):
            self.notices.append(notice)

    notifier = FakeNotifier()
    data = {
        "community": {
            "id": "test",
            "name": "Test Community",
            "monthlyExpensesCents": 100000,
        },
        "units": [
            unit(shareMillionths=500000),
            unit(id="A-102", shareMillionths=500000),
        ],
    }
    generate_billing(data, TODAY, Invoice(), notifier)
    assert [a.charge.unit["id"] for a in notifier.notices] == ["A-101", "A-102"]
    assert notifier.notices[0].payment_code == "INV-test-202603-A-101-55000"
