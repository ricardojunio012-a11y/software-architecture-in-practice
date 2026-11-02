# Reports: only read charges and registrations. A new rule shows up here on its own.
from morada.shared.dates import month_day
from morada.shared.money import dollars


def line(text, amount):
    return "  " + text.ljust(40) + dollars(amount).rjust(10)


def charge_report(title, charges, deadlines):
    lines = [f"# Charges {title}"]
    for c in charges:
        lines += ["", f"{c.unit} {c.resident}"]
        lines += [line(e.description, e.amount) for e in c.entries]
        lines.append(line("Total", c.total))
        if c.discount > 0:
            text = f"Total with discount by {month_day(deadlines.discount_until)}"
            lines.append(line(text, c.total - c.discount))
    return "\n".join(lines) + "\n"


def registration_report(title, gateway, charges, registrations):
    lines = [f"# Registrations {title} - {gateway}"]
    lines.append("unit;identifier;amount;discount")
    for r, c in zip(registrations, charges):
        lines.append(
            f"{r.unit};{r.identifier};{dollars(c.total)};{dollars(c.discount)}"
        )
    return "\n".join(lines) + "\n"
