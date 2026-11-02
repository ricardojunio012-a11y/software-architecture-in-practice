// Step 1: Morada's first code. Everything in one method, the way code is born.
package morada.step1;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class MonthlyBilling {

    public static void generateBilling(String input, String output, LocalDate today)
        throws IOException {
        if (today == null) today = LocalDate.now();
        JsonNode data = new ObjectMapper().readTree(Path.of(input).toFile());
        int year = today.getYear();
        String month = "%02d".formatted(today.getMonthValue());
        String period = month + "/" + year;
        String dueDate = month + "/10/" + year;
        String name = data.get("community").get("name").asText();

        List<String> lines = new ArrayList<>();
        lines.add("# Charges %s - %s - due %s".formatted(period, name, dueDate));
        lines.add("unit;resident;dues;reserve;arrears;late_fee;interest;total;payment");
        StringBuilder emails = new StringBuilder();

        for (JsonNode u : data.get("units")) {
            // dues by ownership share, rounded to the nearest cent
            long expenses = data.get("community").get("monthlyExpensesCents").asLong();
            long dues =
                (expenses * u.get("shareMillionths").asLong() + 500000) / 1000000;
            long reserve = (dues * 10 + 50) / 100; // reserve fund: 10%
            long arrears = 0;
            long lateFee = 0;
            long interest = 0;
            if (!u.get("pastDue").isNull()) {
                arrears = u.get("pastDue").get("amountCents").asLong();
                lateFee = (arrears * 2 + 50) / 100; // 2% late fee
                String pastDueDate = u.get("pastDue").get("dueDate").asText();
                LocalDate due = LocalDate.parse(pastDueDate);
                long days = ChronoUnit.DAYS.between(due, today);
                interest = (arrears * days + 1500) / 3000; // 1% a month, prorated
            }
            long total = dues + reserve + arrears + lateFee + interest;
            String id = u.get("id").asText();
            String resident = u.get("resident").get("name").asText();
            String community = data.get("community").get("id").asText();
            String code = "INV-%s-%d%s-%s-%d".formatted(
                community,
                year,
                month,
                id,
                total
            );

            lines.add(
                String.join(
                    ";",
                    id,
                    resident,
                    dollars(dues),
                    dollars(reserve),
                    dollars(arrears),
                    dollars(lateFee),
                    dollars(interest),
                    dollars(total),
                    code
                )
            );

            emails.append(
                "To: %s\n".formatted(u.get("resident").get("email").asText())
            );
            emails.append(
                "Subject: Monthly dues %s - %s - Unit %s\n\n".formatted(
                    period,
                    name,
                    id
                )
            );
            emails.append("Hello, %s.\n\n".formatted(resident));
            emails.append("The monthly dues for %s for unit %s ".formatted(period, id));
            emails.append("are now available.\n");
            emails.append("Amount: $%s\n".formatted(dollars(total)));
            emails.append("Due date: %s\n".formatted(dueDate));
            if (arrears > 0) {
                emails.append(
                    "Includes a past-due balance of $%s, with a late fee of ".formatted(
                        dollars(arrears)
                    )
                );
                emails.append(
                    "$%s and interest of $%s.\n".formatted(
                        dollars(lateFee),
                        dollars(interest)
                    )
                );
            }
            emails.append("Invoice: %s\n\n".formatted(code));
            emails.append("%s Management\n----\n".formatted(name));
        }

        Files.createDirectories(Path.of(output));
        Files.writeString(
            Path.of(output, "charges.txt"),
            String.join("\n", lines) + "\n"
        );
        Files.writeString(Path.of(output, "emails.txt"), emails.toString());
    }

    private static String dollars(long c) {
        String whole = String.format(Locale.US, "%,d", c / 100);
        return whole + "." + "%02d".formatted(c % 100);
    }
}
