# Unit tests for the three changes, made on the refactored code.
from datetime import date

from morada.step4.application import generate_billing
from morada.step4.calculation import calculate_charge
from morada.step4.payment import Invoice
from morada.step4.card import Card

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


def test_gives_early_payment_discount_without_past_due_balance():
    assert calculate_charge(485000, unit(), TODAY).total_by_5th == 66688 - 3031


def test_gives_no_discount_with_past_due_balance():
    u = unit(pastDue={"amountCents": 1000, "dueDate": "2026-02-10"})
    assert calculate_charge(485000, u, TODAY).total_by_5th is None


def test_uses_card_and_sms_when_the_unit_asks():
    class FakeNotifier:
        def __init__(self):
            self.codes = []

        def notify(self, notice):
            self.codes.append(notice.payment_code)

    email, sms = FakeNotifier(), FakeNotifier()
    data = {
        "community": {
            "id": "test",
            "name": "Test Community",
            "monthlyExpensesCents": 100000,
        },
        "units": [
            unit(shareMillionths=500000),
            unit(
                id="A-102",
                shareMillionths=500000,
                paymentMethod="card",
                resident={
                    "name": "Beth",
                    "email": "beth@example.com",
                    "phone": "+1 555-0100",
                    "channel": "sms",
                },
            ),
        ],
    }
    generate_billing(
        data,
        TODAY,
        {"invoice": Invoice(), "card": Card()},
        {"email": email, "sms": sms},
    )
    assert email.codes == ["INV-test-202603-A-101-55000"]
    assert sms.codes == ["CARD-test-202603-A-102-55000"]
