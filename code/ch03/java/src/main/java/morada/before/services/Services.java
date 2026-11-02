// Billing services: calculates the charges and builds the outputs.
package morada.before.services;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;
import morada.before.config.Config;
import morada.before.reports.Reports;
import morada.before.util.Util;

public final class Services {

    // Public, mutable fields: any module reads and changes them
    public static class Charge {

        public JsonNode unit;
        public long dues, reserve, arrears, lateFee, interest, total;
    }

    // Internal list, but public: anyone can read and change it
    public static final List<Charge> charges = new ArrayList<>();

    private Services() {}

    public static long lateInterest(long amount, String dueDate) {
        return (amount * Util.daysLate(dueDate) + 1500) / 3000;
    }

    public static void calculateAll() {
        long expenses = Config.data
            .get("community")
            .get("monthlyExpensesCents")
            .asLong();
        for (JsonNode u : Config.data.get("units")) {
            Charge c = new Charge();
            c.unit = u;
            c.dues = (expenses * u.get("shareMillionths").asLong() + 500000) / 1000000;
            c.reserve = (c.dues * Config.reservePercent + 50) / 100;
            JsonNode p = u.get("pastDue");
            if (!p.isNull()) {
                c.arrears = p.get("amountCents").asLong();
                c.lateFee = (c.arrears * Config.lateFeePercent + 50) / 100;
                c.interest = lateInterest(c.arrears, p.get("dueDate").asText());
            }
            c.total = c.dues + c.reserve + c.arrears + c.lateFee + c.interest;
            charges.add(c);
        }
    }

    // A parameter decides what the method does (control coupling)
    public static String generateOutput(String type) {
        if (!type.equals("charges")) return Reports.generateReport(type);
        String name = Config.data.get("community").get("name").asText();
        List<String> lines = new ArrayList<>();
        lines.add("# Charges " + Util.period() + " - " + name);
        lines.add("unit;resident;dues;reserve;arrears;late_fee;interest;total");
        for (Charge c : charges) {
            var fields = new ArrayList<>(
                List.of(
                    c.unit.get("id").asText(),
                    c.unit.get("resident").get("name").asText()
                )
            );
            Stream.of(c.dues, c.reserve, c.arrears, c.lateFee, c.interest, c.total)
                .map(Util::dollars)
                .forEach(fields::add);
            lines.add(String.join(";", fields));
        }
        return String.join("\n", lines) + "\n";
    }
}
