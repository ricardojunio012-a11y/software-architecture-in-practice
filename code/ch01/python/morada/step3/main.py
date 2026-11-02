# Usage: python -m morada.step3.main <input.json> <output-folder> [--today YYYY-MM-DD]
# The only place that knows about files, the clock and concrete implementations.
import json
import os
import sys
from datetime import date

from morada.step3.application import generate_billing
from morada.step3.notification import EmailToFile
from morada.step3.payment import Invoice

input_path, output_dir, *options = sys.argv[1:]
today = date.fromisoformat(options[1]) if options[:1] == ["--today"] else date.today()
with open(input_path, encoding="utf-8") as f:
    data = json.load(f)

os.makedirs(output_dir, exist_ok=True)
report = generate_billing(
    data, today, Invoice(), EmailToFile(os.path.join(output_dir, "emails.txt"))
)
report.save(os.path.join(output_dir, "charges.txt"))
print("charges generated in " + output_dir)
