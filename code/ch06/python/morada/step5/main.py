# Usage: python -m morada.step5.main <input.json> <output-folder> [--today YYYY-MM-DD]
# Main does all the input and output; the bookings module does not touch files.
import json
import os
import sys
from datetime import date

from morada.step5.bookings import decide, notices, report

input_file, output, *options = sys.argv[1:]
today = date.fromisoformat(options[1]) if options[:1] == ["--today"] else date.today()
with open(input_file, encoding="utf-8") as f:
    decisions = decide(json.load(f), today)

# The real email client would go here; in the lab, a file
emails = [f"to {to}: {text}" for to, text in notices(decisions)]
os.makedirs(output, exist_ok=True)
for name, lines in (("bookings", report(decisions)), ("emails", emails)):
    with open(os.path.join(output, f"{name}.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
