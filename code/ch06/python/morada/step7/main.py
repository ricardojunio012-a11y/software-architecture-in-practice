# Step 7: the strangler fig. A facade receives every request and decides, space by
# space, who answers: the old code (step 6) or the new one (new.py).
# Usage: python -m morada.step7.main <input.json> <output-folder> [--today YYYY-MM-DD]
import json
import os
import sys
import tempfile
from datetime import date

from morada.step5.bookings import notices, report
from morada.step6.main import process_bookings
from morada.step7.new import decide

# The route of each space. "experiment": the old code answers and the new one runs
# alongside, only to compare. With each validated slice, one space changes route; in
# the end, the old code leaves.
ROUTES = {"party-room": "new", "grill-area": "experiment"}


def route_of(request):
    return ROUTES.get(request["space"], "old")


class RecordingMailer:
    def __init__(self):
        self.sent = []

    def send(self, to, text):
        self.sent.append(f"to {to}: {text}")


# The old code was not made to be called like this: it takes a file and writes another.
# The facade adapts to it, through the step 2 seams, without changing a line of it.
def old_code(data, today):
    dir = tempfile.mkdtemp(prefix="old-")
    file = os.path.join(dir, "requests.json")
    with open(file, "w", encoding="utf-8") as f:
        json.dump(data, f)
    mailer = RecordingMailer()
    process_bookings(file, dir, today, mailer)
    with open(os.path.join(dir, "bookings.txt"), encoding="utf-8") as f:
        lines = f.read().splitlines()
    return {
        r["id"]: (line, email)
        for r, line, email in zip(data["requests"], lines, mailer.sent)
    }


def new_code(data, today):
    decisions = decide(data, today)
    emails = [f"to {to}: {text}" for to, text in notices(decisions)]
    return {
        d.request["id"]: (line, email)
        for d, line, email in zip(decisions, report(decisions), emails)
    }


input_file, output, *options = sys.argv[1:]
today = date.fromisoformat(options[1]) if options[:1] == ["--today"] else date.today()
with open(input_file, encoding="utf-8") as f:
    data = json.load(f)


def only(*routes):
    return {**data, "requests": [r for r in data["requests"] if route_of(r) in routes]}


from_old = old_code(only("old", "experiment"), today)
from_new = new_code(only("new", "experiment"), today)

# The experiment compares the two answers, but the old code is what answers residents
compared = [r["id"] for r in data["requests"] if route_of(r) == "experiment"]
mismatched = [i for i in compared if from_old[i] != from_new[i]]
print(
    f"experiment: {len(compared)} requests compared, {len(mismatched)} with differences"
)
for i in mismatched:
    print(f"  {i}: old {from_old[i][0]} | new {from_new[i][0]}")

answers = [
    (from_new if route_of(r) == "new" else from_old)[r["id"]] for r in data["requests"]
]
os.makedirs(output, exist_ok=True)
for name, column in (("bookings", 0), ("emails", 1)):
    with open(os.path.join(output, f"{name}.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(a[column] for a in answers) + "\n")
