// Usage: java morada.after.Main <commands.json> <output-folder>
// Wires the modules and runs the Billing and Bookings commands in order.
package morada.after;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import morada.after.modules.billing.Billing;
import morada.after.modules.billing.internal.ChargesTable;
import morada.after.modules.bookings.Bookings;
import morada.after.modules.bookings.Bookings.RejectionError;
import morada.after.modules.bookings.internal.StandingFromBilling;

public class Main {

    public static void main(String[] args) throws Exception {
        JsonNode data = new ObjectMapper().readTree(Path.of(args[0]).toFile());
        List<String> spaces = new ArrayList<>();
        data.get("spaces").forEach(s -> spaces.add(s.asText()));
        var billing = new Billing(new ChargesTable());
        var bookings = new Bookings(spaces, new StandingFromBilling(billing));

        List<String> lines = new ArrayList<>();
        for (JsonNode c : data.get("commands")) {
            String[] r = execute(c, billing, bookings);
            lines.add(String.join(";", r[0], c.get("type").asText(), r[1], r[2]));
        }
        Path output = Path.of(args[1]);
        Files.createDirectories(output);
        Files.writeString(
            output.resolve("results.txt"),
            String.join("\n", lines) + "\n"
        );
        System.out.println(lines.size() + " commands executed; output in " + output);
    }

    static String text(JsonNode c, String field) {
        return c.get(field).asText();
    }

    static String[] execute(JsonNode c, Billing billing, Bookings bookings) {
        String charge = c.has("charge") ? text(c, "charge") : null;
        return switch (text(c, "type")) {
            case "issue" -> new String[] {
                charge,
                "issued",
                billing.issue(
                    charge,
                    text(c, "unit"),
                    c.get("amountCents").asLong(),
                    text(c, "dueDate")
                ),
            };
            case "pay" -> new String[] {
                charge,
                "paid",
                billing.pay(charge, text(c, "on")),
            };
            case "split" -> new String[] {
                charge,
                "split",
                billing.split(charge, c.get("installments").asInt()),
            };
            default -> book(c, bookings);
        };
    }

    static String[] book(JsonNode c, Bookings bookings) {
        String booking = text(c, "booking");
        try {
            String detail = bookings.book(
                booking,
                text(c, "unit"),
                text(c, "space"),
                text(c, "date"),
                text(c, "on")
            );
            return new String[] { booking, "confirmed", detail };
        } catch (RejectionError error) {
            return new String[] { booking, "rejected", error.getMessage() };
        }
    }
}
