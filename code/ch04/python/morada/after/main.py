# Usage: python -m morada.after.main <input.json> <output-folder> [--today YYYY-MM-DD]
# Composition root: the only place that knows the concrete classes and assembles them.
import json
import os
import sys
from datetime import date

from morada.shared.dates import date_in_month, month_label
from morada.after.billing.calculator import ChargeCalculator
from morada.after.billing.rules.board_president_exemption import (
    BoardPresidentExemption,
)
from morada.after.billing.rules.early_payment_discount import EarlyPaymentDiscount
from morada.after.billing.rules.late_fee import LateFee
from morada.after.billing.rules.late_interest import LateInterest
from morada.after.billing.rules.monthly_dues import MonthlyDues
from morada.after.billing.rules.past_due_balance import PastDueBalance
from morada.after.billing.rules.reserve_fund import ReserveFund
from morada.after.issuing.gateway import Deadlines
from morada.after.issuing.issuing_service import IssuingService
from morada.after.providers.alpha_bank_gateway import AlphaBankGateway
from morada.after.providers.easy_pay_gateway import EasyPayGateway
from morada.after.reports import charge_report, registration_report
from morada.external.alpha_bank import AlphaBankClient
from morada.external.easy_pay import EasyPayApi

input_file, output, *options = sys.argv[1:]
today = date.fromisoformat(options[1]) if options[:1] == ["--today"] else date.today()
with open(input_file, encoding="utf-8") as f:
    data = json.load(f)
p = data["policy"]
deadlines = Deadlines(
    due_date=date_in_month(today, p["dueDay"]),
    discount_until=date_in_month(today, p["discountByDay"]),
)

# Order matters: each rule sees what the previous ones posted
rules = [
    MonthlyDues(data["community"]["monthlyExpensesCents"]),
    ReserveFund(p["reserveFundPercent"]),
    BoardPresidentExemption(),
    PastDueBalance(),
    LateFee(p["lateFeePercent"]),
    LateInterest(p["monthlyInterestPercent"], today),
    # Last: the discount depends on the exemption and the past-due balance already posted
    EarlyPaymentDiscount(p["earlyDiscountPercent"], deadlines.discount_until),
]
gateways = {
    "alpha": lambda: AlphaBankGateway(AlphaBankClient()),
    "easypay": lambda: EasyPayGateway(EasyPayApi()),
}
gateway = gateways[os.environ.get("GATEWAY", "alpha")]()
service = IssuingService(ChargeCalculator(rules), gateway, deadlines)

charges, registrations = service.issue(data["units"])
title = f"{month_label(today)} - {data['community']['name']}"
reports = {
    "charges": charge_report(title, charges, deadlines),
    "registrations": registration_report(title, gateway.name, charges, registrations),
}
os.makedirs(output, exist_ok=True)
for name, text in reports.items():
    with open(os.path.join(output, f"{name}.txt"), "w", encoding="utf-8") as f:
        f.write(text)
print(f"charges issued in {output} ({gateway.name})")
