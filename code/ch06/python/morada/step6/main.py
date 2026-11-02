# Original bookings module, written in a hurry for the first owners' meeting.
# DO NOT TOUCH without talking to George!!! (calculates weekend)
# Step 6: the new rule goes into the legacy code without refactoring it. From step 2
# (seams only), it changes the minimum: a sprout (limit.py) and a wrapper (log_run).
import json
import os
import sys
from datetime import date

from morada.step6.limit import MonthlyLimit

approved = []
log = []


class Smtp:
    def send(self, to, txt):
        log.append("to " + to + ": " + txt)


smtp = Smtp()


def process_bookings_without_log(fn, dir, td=None, mailer=smtp):
    td = td or date.today()
    d = json.load(open(fn, encoding="utf-8"))
    out = []
    for r in d["requests"]:
        u = [x for x in d["units"] if x["id"] == r["unit"]][0]
        s = [x for x in d["spaces"] if x["id"] == r["space"]][0]
        ok = True
        msg = ""
        if u["inArrears"]:
            ok = False
            msg = "arrears"
        else:
            n = (date.fromisoformat(r["date"]) - td).days
            if n < 2:
                ok = False
                msg = "short notice"
            else:
                for a in approved:
                    if a["space"] == r["space"] and a["date"] == r["date"]:
                        ok = False
                        msg = "conflict"
                # Sprout: the new rule is only this call; the rest is in limit.py
                if ok and MonthlyLimit().reached(r, approved):
                    ok = False
                    msg = "monthly booking limit reached"
        if ok:
            # calculates the amount
            v = s["fee"]
            if date.fromisoformat(r["date"]).weekday() == 5:
                v = v + v * 20 // 100  # weekend
            if r["guests"] > 50:
                v = v + 5000
            approved.append(r)
            vv = str(v // 100) + "." + str(v % 100).zfill(2)
            out.append(f"{r['id']};{r['unit']};{r['space']};{r['date']};approved;{vv}")
            mailer.send(u["email"], "Booking " + r["id"] + " confirmed. Amount: $" + vv)
        else:
            out.append(f"{r['id']};{r['unit']};{r['space']};{r['date']};declined;{msg}")
            mailer.send(u["email"], "Booking " + r["id"] + " declined (" + msg + ")")
    os.makedirs(dir, exist_ok=True)
    open(dir + "/bookings.txt", "w", encoding="utf-8").write("\n".join(out) + "\n")
    open(dir + "/emails.txt", "w", encoding="utf-8").write("\n".join(log) + "\n")


# Wrap method: the old name now calls the old code, untouched, and then the new
# behavior. Whoever called process_bookings does not notice the change.
def process_bookings(fn, dir, td=None, mailer=smtp):
    td = td or date.today()
    process_bookings_without_log(fn, dir, td, mailer)
    log_run(dir, td)


# The board president wanted a log of each run, for the financial report to owners
def log_run(dir, td):
    lines = open(dir + "/bookings.txt", encoding="utf-8").read().strip().splitlines()
    approved = len([line for line in lines if ";approved;" in line])
    print(f"log {td.isoformat()}: {len(lines)} requests, {approved} approved")


# Usage: python -m morada.step6.main <input.json> <output-folder> [--today YYYY-MM-DD]
# Runs only when the file is the program, not when another module imports it
if __name__ == "__main__":
    input_file, output, *options = sys.argv[1:]
    today = (
        date.fromisoformat(options[1]) if options[:1] == ["--today"] else date.today()
    )
    process_bookings(input_file, output, today)
