# Usage: python -m morada.before.main <commands.json> <output-folder>
import json
import os
import sys

from morada.before.model import bookings
from morada.before.service import book, cancel, hours

input_path, output = sys.argv[1:3]
with open(input_path, encoding="utf-8") as f:
    data = json.load(f)
events, results = [], []
for c in data["commands"]:
    space = next((s for s in data["spaces"] if s["id"] == c.get("space")), None)
    r = book(c, space, events) if c["type"] == "book" else cancel(c, events)
    results.append(f"{c['booking']};{c['type']};{r}")
schedule = [
    f"{b.space};{b.id};{b.date} {hours(b.start, b.end)};{b.unit}"
    for s in data["spaces"]
    for b in bookings
    if b.space == s["id"] and b.status == "confirmed"
]

os.makedirs(output, exist_ok=True)
for name, lines in (
    ("results", results),
    ("events", events),
    ("schedule", schedule),
):
    with open(os.path.join(output, f"{name}.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
print(f"{len(results)} commands executed; output in {output}")
