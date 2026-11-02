# Original bookings module, written in a hurry for the first owners' meeting.
# DO NOT TOUCH without talking to George!!! (calculates weekend)
# Step 2: only the seams. Today's date and the email sender come in as parameters,
# with the old behavior as the default. Nothing else changed.
import json
import os
import sys
from datetime import date

approved = []
log = []


class Smtp:
    def send(self, to, txt):
        log.append("to " + to + ": " + txt)


smtp = Smtp()


def process_bookings(fn, dir, td=None, mailer=smtp):
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


# Usage: python -m morada.step2.main <input.json> <output-folder> [--today YYYY-MM-DD]
input_file, output, *options = sys.argv[1:]
today = date.fromisoformat(options[1]) if options[:1] == ["--today"] else date.today()
process_bookings(input_file, output, today)
