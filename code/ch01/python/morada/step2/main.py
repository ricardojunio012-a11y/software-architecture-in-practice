# Usage: python -m morada.step2.main <input.json> <output-folder> [--today YYYY-MM-DD]
import sys
from datetime import date

from morada.step2.billing import generate_billing

input_path, output_dir, *options = sys.argv[1:]
today = date.fromisoformat(options[1]) if options[:1] == ["--today"] else None
generate_billing(input_path, output_dir, today)
print("charges generated in " + output_dir)
