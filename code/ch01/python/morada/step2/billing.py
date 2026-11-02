# Step 2: the original code after the three change requests
# (early-payment discount, card payments and text messages), done the most direct way.
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
    discount_deadline = f"{month}/05/{year}"
    name = data["community"]["name"]

    def dollars(c):
        return f"{c // 100:,}" + "." + f"{c % 100:02d}"

    lines = [f"# Charges {period} - {name} - due {due_date}"]
    lines.append(
        "unit;resident;dues;reserve;arrears;late_fee;interest;total;total_by_5th;payment"
    )
    emails = ""
    sms = ""

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
        # 5% off the dues for paying by the 5th with no past-due balance
        total_by_5th = 0
        if arrears == 0:
            total_by_5th = total - (dues * 5 + 50) // 100
        if u["paymentMethod"] == "card":
            code = f"CARD-{data['community']['id']}-{year}{month}-{u['id']}-{total}"
        else:
            code = f"INV-{data['community']['id']}-{year}{month}-{u['id']}-{total}"

        values = [
            dollars(v) for v in (dues, reserve, arrears, late_fee, interest, total)
        ]
        values.append(dollars(total_by_5th) if total_by_5th > 0 else "-")
        lines.append(";".join([u["id"], u["resident"]["name"], *values, code]))

        if u["resident"]["channel"] == "sms":
            sms += f"To: {u['resident']['phone']}\n"
            sms += f"{name}: dues {period} for unit {u['id']}: "
            sms += f"${dollars(total)}, due {due_date}."
            if total_by_5th > 0:
                sms += f" By {discount_deadline}: ${dollars(total_by_5th)}."
            method = "Card payment" if u["paymentMethod"] == "card" else "Invoice"
            sms += f" {method}: {code}\n----\n"
        else:
            emails += f"To: {u['resident']['email']}\n"
            emails += f"Subject: Monthly dues {period} - {name}"
            emails += f" - Unit {u['id']}\n\n"
            emails += f"Hello, {u['resident']['name']}.\n\n"
            emails += f"The monthly dues for {period} for unit {u['id']} "
            emails += "are now available.\n"
            emails += f"Amount: ${dollars(total)}\n"
            emails += f"Due date: {due_date}\n"
            if total_by_5th > 0:
                emails += f"Pay by {discount_deadline} and the amount drops to "
                emails += f"${dollars(total_by_5th)}.\n"
            if arrears > 0:
                emails += f"Includes a past-due balance of ${dollars(arrears)}, "
                emails += (
                    f"with a late fee of ${dollars(late_fee)} "
                    f"and interest of ${dollars(interest)}.\n"
                )
            if u["paymentMethod"] == "card":
                emails += f"Card payment: {code}\n\n"
            else:
                emails += f"Invoice: {code}\n\n"
            emails += f"{name} Management\n----\n"

    os.makedirs(output_dir, exist_ok=True)
    with open(os.path.join(output_dir, "charges.txt"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    with open(os.path.join(output_dir, "emails.txt"), "w", encoding="utf-8") as f:
        f.write(emails)
    with open(os.path.join(output_dir, "sms.txt"), "w", encoding="utf-8") as f:
        f.write(sms)
