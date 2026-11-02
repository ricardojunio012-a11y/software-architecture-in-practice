// Delinquency report: reads the charges, never changes them.
package morada.after.delinquency;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import morada.after.charges.Charge;
import morada.after.shared.Dates;
import morada.after.shared.Money;

public final class Delinquency {

    private Delinquency() {}

    public static String report(
        String community,
        LocalDate today,
        List<Charge> charges
    ) {
        // A new, sorted list: the one received stays as it was
        List<Charge> inArrears = charges
            .stream()
            .filter(c -> c.arrears() > 0)
            .sorted(Comparator.comparingLong(Charge::arrears).reversed())
            .toList();
        List<String> lines = new ArrayList<>();
        lines.add("# Delinquency " + Dates.monthLabel(today) + " - " + community);
        lines.add("unit;resident;days;arrears;late_fee;interest;amount_due");
        long[] sum = new long[4];
        for (Charge c : inArrears) {
            long[] values = {
                c.arrears(),
                c.lateFee(),
                c.interest(),
                c.arrears() + c.lateFee() + c.interest(),
            };
            var fields = new ArrayList<>(
                List.of(c.unit(), c.resident(), String.valueOf(c.daysLate()))
            );
            for (int i = 0; i < 4; i++) {
                sum[i] += values[i];
                fields.add(Money.dollars(values[i]));
            }
            lines.add(String.join(";", fields));
        }
        var total = new ArrayList<>(List.of("total", "", ""));
        for (long s : sum) total.add(Money.dollars(s));
        lines.add(String.join(";", total));
        return String.join("\n", lines) + "\n";
    }
}
