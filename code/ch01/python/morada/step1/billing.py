# Step 1: Morada's first code. Everything in one function, the way code is born.
import json
import os
from datetime import date


def generate_billing(input_path, output_dir, today=None):
    today = today or date.today()
    with open(input_path, encoding="utf-8") as f:
        data = json.load(f)
    year = today.year
    month = f"{today.month:02d}"
    period = f"{month}/{year}"
    due_date = f"{month}/10/{year}"
    name = data["community"]["name"]

    def dollars(c):
        return f"{c // 100:,}" + "." + f"{c % 100:02d}"

    lines = [f"# Charges {period} - {name} - due {due_date}"]
    lines.append("unit;resident;dues;reserve;arrears;late_fee;interest;total;payment")
    emails = ""

    for u in data["units"]:
        # dues by ownership share, rounded to the nearest cent
        expenses = data["community"]["monthlyExpensesCents"]
        dues = (expenses * u["shareMillionths"] + 500000) // 1000000
        reserve = (dues * 10 + 50) // 100  # reserve fund: 10%
        arrears = 0
        late_fee = 0
        interest = 0
        if u["pastDue"]:
            arrears = u["pastDue"]["amountCents"]
            late_fee = (arrears * 2 + 50) // 100  # 2% late fee
            due = date.fromisoformat(u["pastDue"]["dueDate"])
            days = (today - due).days
            interest = (arrears * days + 1500) // 3000  # 1% a month, prorated
        total = dues + reserve + arrears + late_fee + interest
        code = f"INV-{data['community']['id']}-{year}{month}-{u['id']}-{total}"

        values = [
            dollars(v) for v in (dues, reserve, arrears, late_fee, interest, total)
        ]
        lines.append(";".join([u["id"], u["resident"]["name"], *values, code]))

        emails += f"To: {u['resident']['email']}\n"
        emails += f"Subject: Monthly dues {period} - {name}"
        emails += f" - Unit {u['id']}\n\n"
        emails += f"Hello, {u['resident']['name']}.\n\n"
        emails += f"The monthly dues for {period} for unit {u['id']} "
        emails += "are now available.\n"
        emails += f"Amount: ${dollars(total)}\n"
        emails += f"Due date: {due_date}\n"
        if arrears > 0:
            emails += f"Includes a past-due balance of ${dollars(arrears)}, "
            emails += f"with a late fee of ${dollars(late_fee)} "
            emails += f"and interest of ${dollars(interest)}.\n"
        emails += f"Invoice: {code}\n\n"
        emails += f"{name} Management\n----\n"

    os.makedirs(output_dir, exist_ok=True)
    with open(os.path.join(output_dir, "charges.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    with open(os.path.join(output_dir, "emails.txt"), "w", encoding="utf-8") as f:
        f.write(emails)
