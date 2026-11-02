# Billing reports: delinquency and the financial report to owners.
import morada.before.services.services as services
from morada.before.config.config import config
from morada.before.util.util import days_late, dollars, period


def generate_report(report_type):
    name = config.data["community"]["name"]
    if report_type == "delinquency":
        # Sorts the other module's list in place (content coupling)
        services.charges.sort(key=lambda c: c["arrears"], reverse=True)
        lines = [f"# Delinquency {period()} - {name}"]
        lines.append("unit;resident;days;arrears;late_fee;interest;amount_due")
        total = [0, 0, 0, 0]
        for c in [x for x in services.charges if x["arrears"] > 0]:
            due = c["unit"]["pastDue"]["dueDate"]
            # recalculates what already exists
            interest = services.late_interest(c["arrears"], due)
            values = [
                c["arrears"],
                c["late_fee"],
                interest,
                c["arrears"] + c["late_fee"] + interest,
            ]
            total = [s + v for s, v in zip(total, values)]
            u = c["unit"]
            fields = [u["id"], u["resident"]["name"], str(days_late(due))]
            lines.append(";".join(fields + [dollars(v) for v in values]))
        lines.append(";".join(["total", "", ""] + [dollars(s) for s in total]))
        return "\n".join(lines) + "\n"
    # any other type becomes the financial report
    dues = sum(c["dues"] for c in services.charges)
    reserve = sum(c["reserve"] for c in services.charges)
    lines = [f"# Financial report {period()} - {name}"]
    lines.append(f"income;monthly dues;{dollars(dues)}")
    lines.append(f"income;reserve fund;{dollars(reserve)}")
    total_expenses = 0
    for e in config.data["expenses"]:
        total_expenses += e["amountCents"]
        lines.append(f"expenses;{e['category']};{dollars(e['amountCents'])}")
    lines.append(f"expenses;total;{dollars(total_expenses)}")
    balance = config.data["reserveFundOpeningBalanceCents"]
    lines.append(f"reserve;opening balance;{dollars(balance)}")
    lines.append(f"reserve;projected balance;{dollars(balance + reserve)}")
    return "\n".join(lines) + "\n"
