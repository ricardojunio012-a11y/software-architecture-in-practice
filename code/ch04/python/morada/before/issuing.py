# Everything in one function: the rules one if after another and Alpha Bank called in
# the middle of the calculation. A new rule or another bank means changing this function.
from morada.shared.dates import (
    date_in_month,
    days_between,
    month_day,
    month_label,
    us_date,
)
from morada.shared.money import dollars, percent_of, plain_dollars, share_of
from morada.external.alpha_bank import AlphaBankClient


def line(text, amount):
    return "  " + text.ljust(40) + dollars(amount).rjust(10)


def issue_charges(data, today):
    p = data["policy"]
    due_date = date_in_month(today, p["dueDay"])
    discount_until = date_in_month(today, p["discountByDay"])
    title = f"{month_label(today)} - {data['community']['name']}"
    bank = AlphaBankClient()
    charges = [f"# Charges {title}"]
    registrations = [f"# Registrations {title} - Alpha Bank"]
    registrations.append("unit;identifier;amount;discount")

    for u in data["units"]:
        items = []
        expenses = data["community"]["monthlyExpensesCents"]
        dues = share_of(expenses, u["shareMillionths"])
        items.append(("Monthly dues", dues))
        reserve = percent_of(dues, p["reserveFundPercent"])
        items.append((f"Reserve fund ({p['reserveFundPercent']}%)", reserve))
        if u.get("boardPresident"):
            items.append(("Board president exemption", -dues))
        d = u["pastDue"]
        if d:
            a = d["amountCents"]
            days = days_between(d["dueDate"], today)
            interest = (a * p["monthlyInterestPercent"] * days + 1500) // 3000
            items.append((f"Past-due balance (due {month_day(d['dueDate'])})", a))
            items.append(
                (
                    f"Late fee ({p['lateFeePercent']}%)",
                    percent_of(a, p["lateFeePercent"]),
                )
            )
            items.append((f"Interest ({days} days)", interest))
        total = sum(amount for _, amount in items)
        pd = p["earlyDiscountPercent"]
        # No discount for the board president or for units in arrears (chapter 1 rule)
        discount = 0 if u.get("boardPresident") or d else percent_of(dues, pd)

        charges += ["", f"{u['id']} {u['resident']['name']}"]
        charges += [line(t, a) for t, a in items]
        by = month_day(discount_until)
        if discount > 0:
            charges.append(line(f"Discount by {by} ({pd}%)", -discount))
        charges.append(line("Total", total))
        if discount > 0:
            charges.append(line(f"Total with discount by {by}", total - discount))

        # The calculation knows the bank: changing banks means changing this function
        request = {
            "payer": u["resident"]["name"],
            "amount": plain_dollars(total),
            "dueDate": us_date(due_date),
        }
        if discount > 0:
            request["discount"] = {
                "amount": plain_dollars(discount),
                "until": us_date(discount_until),
            }
        invoice = bank.create_invoice(request)
        registrations.append(
            f"{u['id']};invoice {invoice['invoiceNumber']};"
            f"{dollars(total)};{dollars(discount)}"
        )
    return "\n".join(charges) + "\n", "\n".join(registrations) + "\n"
