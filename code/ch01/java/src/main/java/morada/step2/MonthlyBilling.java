// Step 2: the original code after the three change requests
// (early-payment discount, card payments and text messages), done the most direct way.
package morada.step2;

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
        String discountDeadline = month + "/05/" + year;
        String name = data.get("community").get("name").asText();

        List<String> lines = new ArrayList<>();
        lines.add("# Charges %s - %s - due %s".formatted(period, name, dueDate));
        lines.add(
            "unit;resident;dues;reserve;arrears;late_fee;interest;total;total_by_5th;payment"
        );
        StringBuilder emails = new StringBuilder();
        StringBuilder sms = new StringBuilder();

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
            // 5% off the dues for paying by the 5th with no past-due balance
            long totalBy5th = 0;
            if (arrears == 0) {
                totalBy5th = total - (dues * 5 + 50) / 100;
            }
            String id = u.get("id").asText();
            String resident = u.get("resident").get("name").asText();
            String community = data.get("community").get("id").asText();
            boolean card = u.get("paymentMethod").asText().equals("card");
            String code;
            if (card) {
                code = "CARD-%s-%d%s-%s-%d".formatted(
                    community,
                    year,
                    month,
                    id,
                    total
                );
            } else {
                code = "INV-%s-%d%s-%s-%d".formatted(community, year, month, id, total);
            }

            String discounted = totalBy5th > 0 ? dollars(totalBy5th) : "-";
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
                    discounted,
                    code
                )
            );

            if (u.get("resident").get("channel").asText().equals("sms")) {
                sms.append(
                    "To: %s\n".formatted(u.get("resident").get("phone").asText())
                );
                sms.append("%s: dues %s for unit %s: ".formatted(name, period, id));
                sms.append("$%s, due %s.".formatted(dollars(total), dueDate));
                if (totalBy5th > 0) {
                    sms.append(
                        " By %s: $%s.".formatted(discountDeadline, dollars(totalBy5th))
                    );
                }
                String method = card ? "Card payment" : "Invoice";
                sms.append(" %s: %s\n----\n".formatted(method, code));
            } else {
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
                emails.append(
                    "The monthly dues for %s for unit %s ".formatted(period, id)
                );
                emails.append("are now available.\n");
                emails.append("Amount: $%s\n".formatted(dollars(total)));
                emails.append("Due date: %s\n".formatted(dueDate));
                if (totalBy5th > 0) {
                    emails.append(
                        "Pay by %s and the amount drops to ".formatted(discountDeadline)
                    );
                    emails.append("$%s.\n".formatted(dollars(totalBy5th)));
                }
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
                if (card) {
                    emails.append("Card payment: %s\n\n".formatted(code));
                } else {
                    emails.append("Invoice: %s\n\n".formatted(code));
                }
                emails.append("%s Management\n----\n".formatted(name));
            }
        }

        Files.createDirectories(Path.of(output));
        Files.writeString(
            Path.of(output, "charges.txt"),
            String.join("\n", lines) + "\n"
        );
        Files.writeString(Path.of(output, "emails.txt"), emails.toString());
        Files.writeString(Path.of(output, "sms.txt"), sms.toString());
    }

    private static String dollars(long c) {
        String whole = String.format(Locale.US, "%,d", c / 100);
        return whole + "." + "%02d".formatted(c % 100);
    }
}
