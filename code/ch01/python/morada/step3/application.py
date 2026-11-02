# Orchestrates the monthly run: calculates, creates the payment, records and notifies.
from datetime import date

from morada.step3.calculation import calculate_charge
from morada.step3.period import period_of
from morada.step3.notification import Notice, Notifier
from morada.step3.payment import PaymentMethod
from morada.step3.report import ChargeReport


def generate_billing(
    data: dict,
    today: date,
    payment: PaymentMethod,
    notifier: Notifier,
) -> ChargeReport:
    community = data["community"]
    period = period_of(today)
    report = ChargeReport(community["name"], period)
    for unit in data["units"]:
        charge = calculate_charge(community["monthlyExpensesCents"], unit, today)
        code = payment.generate_code(community["id"], period, charge)
        report.add(charge, code)
        notifier.notify(Notice(community["name"], period, charge, payment.name, code))
    return report
