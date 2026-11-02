// Reports: only read charges and registrations. A new rule shows up here on its own.
package morada.after;

import static morada.shared.Money.dollars;

import java.util.ArrayList;
import java.util.List;
import morada.after.billing.Charge;
import morada.after.billing.Entry;
import morada.after.issuing.PaymentGateway.Deadlines;
import morada.after.issuing.PaymentGateway.Registration;
import morada.shared.Dates;

public final class Reports {

    private Reports() {}

    static String line(String text, long amount) {
        return String.format("  %-40s%10s", text, dollars(amount));
    }

    public static String charges(
        String title,
        List<Charge> charges,
        Deadlines deadlines
    ) {
        List<String> lines = new ArrayList<>(List.of("# Charges " + title));
        for (Charge c : charges) {
            lines.add("");
            lines.add(c.unit() + " " + c.resident());
            for (Entry e : c.entries()) lines.add(line(e.description(), e.amount()));
            lines.add(line("Total", c.total()));
            if (c.discount() > 0) {
                String by = Dates.monthDay(deadlines.discountUntil());
                lines.add(
                    line("Total with discount by " + by, c.total() - c.discount())
                );
            }
        }
        return String.join("\n", lines) + "\n";
    }

    public static String registrations(
        String title,
        String gateway,
        List<Charge> charges,
        List<Registration> registrations
    ) {
        List<String> lines = new ArrayList<>();
        lines.add("# Registrations " + title + " - " + gateway);
        lines.add("unit;identifier;amount;discount");
        for (int i = 0; i < registrations.size(); i++) {
            Registration r = registrations.get(i);
            Charge c = charges.get(i);
            String amounts = dollars(c.total()) + ";" + dollars(c.discount());
            lines.add(r.unit() + ";" + r.identifier() + ";" + amounts);
        }
        return String.join("\n", lines) + "\n";
    }
}
