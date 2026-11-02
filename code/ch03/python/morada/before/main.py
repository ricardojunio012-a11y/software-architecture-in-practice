# Usage: python -m morada.before.main <input.json> <output-folder> [--today YYYY-MM-DD]
import json
import os
import sys
from datetime import date

from morada.before.config.config import config
from morada.before.services.services import calculate_all, generate_output

input_file, output, *options = sys.argv[1:]
config.today = (
    date.fromisoformat(options[1]) if options[:1] == ["--today"] else date.today()
)
with open(input_file, encoding="utf-8") as f:
    config.data = json.load(f)
calculate_all()

# The order matters: the delinquency report reorders the list of charges
os.makedirs(output, exist_ok=True)
for report_type in ("charges", "delinquency", "financial-report"):
    with open(os.path.join(output, f"{report_type}.txt"), "w", encoding="utf-8") as f:
        f.write(generate_output(report_type))
print("reports generated in " + output)
