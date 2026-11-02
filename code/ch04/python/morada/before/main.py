# Usage: python -m morada.before.main <input.json> <output-folder> [--today YYYY-MM-DD]
# The gateway is hard-coded: the GATEWAY variable changes nothing here.
import json
import os
import sys
from datetime import date

from morada.before.issuing import issue_charges

input_file, output, *options = sys.argv[1:]
today = date.fromisoformat(options[1]) if options[:1] == ["--today"] else date.today()
with open(input_file, encoding="utf-8") as f:
    data = json.load(f)
charges, registrations = issue_charges(data, today)
os.makedirs(output, exist_ok=True)
for name, text in (("charges", charges), ("registrations", registrations)):
    with open(os.path.join(output, f"{name}.txt"), "w", encoding="utf-8") as f:
        f.write(text)
print("charges issued in " + output)
