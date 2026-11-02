# Billing services: calculates the charges and builds the outputs.
from morada.before.config.config import config
from morada.before.util.util import days_late, dollars, period

# Internal list, but public: anyone can read and change it
charges = []


def late_interest(amount, due_date):
    return (amount * days_late(due_date) + 1500) // 3000


def calculate_all():
    expenses = config.data["community"]["monthlyExpensesCents"]
    for u in config.data["units"]:
        dues = (expenses * u["shareMillionths"] + 500000) // 1000000
        reserve = (dues * config.reserve_percent + 50) // 100
        p = u["pastDue"]
        arrears = p["amountCents"] if p else 0
        late_fee = (arrears * config.late_fee_percent + 50) // 100 if p else 0
        interest = late_interest(arrears, p["dueDate"]) if p else 0
        total = dues + reserve + arrears + late_fee + interest
        charges.append(
            dict(
                unit=u,
                dues=dues,
                reserve=reserve,
                arrears=arrears,
                late_fee=late_fee,
                interest=interest,
                total=total,
            )
        )


# A parameter decides what the function does (control coupling)
def generate_output(report_type):
    if report_type != "charges":
        return generate_report(report_type)
    lines = [f"# Charges {period()} - {config.data['community']['name']}"]
    lines.append("unit;resident;dues;reserve;arrears;late_fee;interest;total")
    for c in charges:
        fields = ("dues", "reserve", "arrears", "late_fee", "interest", "total")
        amounts = [dollars(c[k]) for k in fields]
        lines.append(
            ";".join([c["unit"]["id"], c["unit"]["resident"]["name"], *amounts])
        )
    return "\n".join(lines) + "\n"


# The cycle with reports forces the import to the end of the file
from morada.before.reports.reports import generate_report  # noqa: E402
