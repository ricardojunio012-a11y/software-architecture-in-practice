# Usage: python -m morada.step4.main <input.json> <output-folder> [--today YYYY-MM-DD]
# The only place that knows about files, the clock and concrete implementations.
import json
import os
import sys
from datetime import date

from morada.step4.application import generate_billing
from morada.step4.notification import EmailToFile
from morada.step4.payment import Invoice
from morada.step4.card import Card
from morada.step4.sms import SmsToFile

input_path, output_dir, *options = sys.argv[1:]
today = date.fromisoformat(options[1]) if options[:1] == ["--today"] else date.today()
with open(input_path, encoding="utf-8") as f:
    data = json.load(f)

os.makedirs(output_dir, exist_ok=True)
payment_methods = {"invoice": Invoice(), "card": Card()}
notifiers = {
    "email": EmailToFile(os.path.join(output_dir, "emails.txt")),
    "sms": SmsToFile(os.path.join(output_dir, "sms.txt")),
}
report = generate_billing(data, today, payment_methods, notifiers)
report.save(os.path.join(output_dir, "charges.txt"))
print("charges generated in " + output_dir)
