# Usage: python -m morada.after.main <input.json> <output-folder> [--today YYYY-MM-DD]
# Wires the modules together; the order of the reports no longer matters.
import json
import os
import sys
from datetime import date

from morada.after.charges import calculate_charges, charge_report
from morada.after.delinquency import delinquency_report
from morada.after.financialreport import financial_report

input_file, output, *options = sys.argv[1:]
today = date.fromisoformat(options[1]) if options[:1] == ["--today"] else date.today()
with open(input_file, encoding="utf-8") as f:
    data = json.load(f)
name = data["community"]["name"]
charges = calculate_charges(
    data["community"]["monthlyExpensesCents"], data["units"], today
)

reports = {
    "delinquency": delinquency_report(name, today, charges),
    "charges": charge_report(name, today, charges),
    "financial-report": financial_report(
        name,
        today,
        charges,
        data["expenses"],
        data["reserveFundOpeningBalanceCents"],
    ),
}
os.makedirs(output, exist_ok=True)
for report_type, text in reports.items():
    with open(os.path.join(output, f"{report_type}.txt"), "w", encoding="utf-8") as f:
        f.write(text)
print("reports generated in " + output)
