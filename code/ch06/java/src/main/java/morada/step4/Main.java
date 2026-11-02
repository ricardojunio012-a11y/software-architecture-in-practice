// Bookings module. Step 4: conditionals and magic numbers (Replace Nested
// Conditional with Guard Clauses, Replace Magic Literal, Replace Loop with Pipeline).
package morada.step4;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

public class Main {

    static final int MIN_NOTICE_DAYS = 2;
    static final int SATURDAY_SURCHARGE_PERCENT = 20;
    static final int GUEST_LIMIT = 50;
    static final long EXTRA_CLEANING_FEE = 5000; // cents

    static List<JsonNode> approved = new ArrayList<>();
    static List<String> log = new ArrayList<>();

    static class Smtp {

        void send(String to, String text) {
            log.add("to " + to + ": " + text);
        }
    }

    static Smtp smtp = new Smtp();

    static long daysUntil(String isoDate, LocalDate today) {
        return ChronoUnit.DAYS.between(today, LocalDate.parse(isoDate));
    }

    // The original comment said "weekend", but the code only checks Saturday
    static boolean isSaturday(String isoDate) {
        return LocalDate.parse(isoDate).getDayOfWeek() == DayOfWeek.SATURDAY;
    }

    static long bookingAmount(JsonNode space, JsonNode request) {
        long amount = space.get("fee").asLong();
        if (isSaturday(request.get("date").asText())) {
            amount += (amount * SATURDAY_SURCHARGE_PERCENT) / 100;
        }
        if (request.get("guests").asInt() > GUEST_LIMIT) {
            amount += EXTRA_CLEANING_FEE;
        }
        return amount;
    }

    static String dollars(long cents) {
        return cents / 100 + "." + String.format("%02d", cents % 100);
    }

    static JsonNode find(JsonNode list, String id) {
        for (JsonNode item : list) if (item.get("id").asText().equals(id)) return item;
        throw new IllegalArgumentException("not found: " + id);
    }

    // Guard clauses: the first rule that fails returns the reason
    static String declineReason(JsonNode request, JsonNode unit, LocalDate today) {
        if (unit.get("inArrears").asBoolean()) return "arrears";
        String date = request.get("date").asText();
        if (daysUntil(date, today) < MIN_NOTICE_DAYS) return "short notice";
        boolean taken = approved
            .stream()
            .anyMatch(
                b ->
                    b.get("space").equals(request.get("space")) &&
                    b.get("date").asText().equals(date)
            );
        if (taken) return "conflict";
        return null;
    }

    public static void processBookings(
        String file,
        String dir,
        LocalDate today,
        Smtp mailer
    ) throws Exception {
        JsonNode data = new ObjectMapper().readTree(new File(file));
        List<String> lines = new ArrayList<>();
        for (JsonNode request : data.get("requests")) {
            JsonNode unit = find(data.get("units"), request.get("unit").asText());
            JsonNode space = find(data.get("spaces"), request.get("space").asText());
            String reason = declineReason(request, unit, today);
            String id = request.get("id").asText();
            String head = String.join(
                ";",
                id,
                request.get("unit").asText(),
                request.get("space").asText(),
                request.get("date").asText()
            );
            String email = unit.get("email").asText();
            if (reason != null) {
                lines.add(head + ";declined;" + reason);
                mailer.send(email, "Booking " + id + " declined (" + reason + ")");
                continue;
            }
            String amount = dollars(bookingAmount(space, request));
            approved.add(request);
            lines.add(head + ";approved;" + amount);
            mailer.send(email, "Booking " + id + " confirmed. Amount: $" + amount);
        }
        Files.createDirectories(Path.of(dir));
        Files.writeString(
            Path.of(dir, "bookings.txt"),
            String.join("\n", lines) + "\n"
        );
        Files.writeString(Path.of(dir, "emails.txt"), String.join("\n", log) + "\n");
    }

    // Usage: java morada.step4.Main <input.json> <output-folder> [--today YYYY-MM-DD]
    public static void main(String[] args) throws Exception {
        LocalDate today =
            args.length > 3 && args[2].equals("--today")
                ? LocalDate.parse(args[3])
                : LocalDate.now();
        processBookings(args[0], args[1], today, smtp);
    }
}
