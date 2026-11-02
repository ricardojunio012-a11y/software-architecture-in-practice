# Orchestrates the monthly run: calculates, creates the payment, records and notifies.
from datetime import date

from morada.step4.calculation import calculate_charge
from morada.step4.period import period_of
from morada.step4.notification import Notice, Notifier
from morada.step4.payment import PaymentMethod
from morada.step4.report import ChargeReport


def generate_billing(
    data: dict,
    today: date,
    payment_methods: dict[str, PaymentMethod],
    notifiers: dict[str, Notifier],
) -> ChargeReport:
    community = data["community"]
    period = period_of(today)
    report = ChargeReport(community["name"], period)
    for unit in data["units"]:
        payment = payment_methods[unit["paymentMethod"]]
        notifier = notifiers[unit["resident"]["channel"]]
        charge = calculate_charge(community["monthlyExpensesCents"], unit, today)
        code = payment.generate_code(community["id"], period, charge)
        report.add(charge, code)
        notifier.notify(Notice(community["name"], period, charge, payment.name, code))
    return report
