// Billing reports: delinquency and the financial report to owners.
package morada.before.reports;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import morada.before.config.Config;
import morada.before.services.Services;
import morada.before.util.Util;

public final class Reports {

    private Reports() {}

    public static String generateReport(String type) {
        String name = Config.data.get("community").get("name").asText();
        List<String> lines = new ArrayList<>();
        if (type.equals("delinquency")) {
            // Sorts the other module's list in place (content coupling)
            Services.charges.sort(
                Comparator.comparingLong((Services.Charge c) -> c.arrears).reversed()
            );
            lines.add("# Delinquency " + Util.period() + " - " + name);
            lines.add("unit;resident;days;arrears;late_fee;interest;amount_due");
            long[] sum = new long[4];
            for (Services.Charge c : Services.charges) {
                if (c.arrears == 0) continue;
                String due = c.unit.get("pastDue").get("dueDate").asText();
                // recalculates what already exists
                long interest = Services.lateInterest(c.arrears, due);
                long[] values = {
                    c.arrears,
                    c.lateFee,
                    interest,
                    c.arrears + c.lateFee + interest,
                };
                var fields = new ArrayList<>(
                    List.of(
                        c.unit.get("id").asText(),
                        c.unit.get("resident").get("name").asText(),
                        String.valueOf(Util.daysLate(due))
                    )
                );
                for (int i = 0; i < 4; i++) {
                    sum[i] += values[i];
                    fields.add(Util.dollars(values[i]));
                }
                lines.add(String.join(";", fields));
            }
            var total = new ArrayList<>(List.of("total", "", ""));
            for (long s : sum) total.add(Util.dollars(s));
            lines.add(String.join(";", total));
            return String.join("\n", lines) + "\n";
        }
        // any other type becomes the financial report
        long dues = Services.charges
            .stream()
            .mapToLong(c -> c.dues)
            .sum();
        long reserve = Services.charges
            .stream()
            .mapToLong(c -> c.reserve)
            .sum();
        lines.add("# Financial report " + Util.period() + " - " + name);
        lines.add("income;monthly dues;" + Util.dollars(dues));
        lines.add("income;reserve fund;" + Util.dollars(reserve));
        long totalExpenses = 0;
        for (JsonNode e : Config.data.get("expenses")) {
            long amount = e.get("amountCents").asLong();
            totalExpenses += amount;
            String category = e.get("category").asText();
            lines.add("expenses;" + category + ";" + Util.dollars(amount));
        }
        lines.add("expenses;total;" + Util.dollars(totalExpenses));
        long balance = Config.data.get("reserveFundOpeningBalanceCents").asLong();
        lines.add("reserve;opening balance;" + Util.dollars(balance));
        lines.add("reserve;projected balance;" + Util.dollars(balance + reserve));
        return String.join("\n", lines) + "\n";
    }
}
