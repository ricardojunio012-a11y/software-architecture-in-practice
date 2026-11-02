// Bookings module. Step 3: names that say what things are and extracted
// functions (Rename Variable, Extract Function). The structure is still the original.
package morada.step3;

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
        if (isSaturday(request.get("date").asText())) amount =
            amount + (amount * 20) / 100;
        if (request.get("guests").asInt() > 50) amount = amount + 5000;
        return amount;
    }

    static String dollars(long cents) {
        return cents / 100 + "." + String.format("%02d", cents % 100);
    }

    static JsonNode find(JsonNode list, String id) {
        JsonNode found = null;
        for (JsonNode item : list) if (item.get("id").asText().equals(id)) found = item;
        return found;
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
            String date = request.get("date").asText();
            boolean accepted = true;
            String reason = "";
            if (unit.get("inArrears").asBoolean()) {
                accepted = false;
                reason = "arrears";
            } else {
                if (daysUntil(date, today) < 2) {
                    accepted = false;
                    reason = "short notice";
                } else {
                    for (JsonNode booking : approved) {
                        if (
                            booking.get("space").equals(request.get("space")) &&
                            booking.get("date").equals(request.get("date"))
                        ) {
                            accepted = false;
                            reason = "conflict";
                        }
                    }
                }
            }
            String id = request.get("id").asText();
            String head = String.join(
                ";",
                id,
                request.get("unit").asText(),
                request.get("space").asText(),
                date
            );
            String email = unit.get("email").asText();
            if (accepted) {
                String amount = dollars(bookingAmount(space, request));
                approved.add(request);
                lines.add(head + ";approved;" + amount);
                mailer.send(email, "Booking " + id + " confirmed. Amount: $" + amount);
            } else {
                lines.add(head + ";declined;" + reason);
                mailer.send(email, "Booking " + id + " declined (" + reason + ")");
            }
        }
        Files.createDirectories(Path.of(dir));
        Files.writeString(
            Path.of(dir, "bookings.txt"),
            String.join("\n", lines) + "\n"
        );
        Files.writeString(Path.of(dir, "emails.txt"), String.join("\n", log) + "\n");
    }

    // Usage: java morada.step3.Main <input.json> <output-folder> [--today YYYY-MM-DD]
    public static void main(String[] args) throws Exception {
        LocalDate today =
            args.length > 3 && args[2].equals("--today")
                ? LocalDate.parse(args[3])
                : LocalDate.now();
        processBookings(args[0], args[1], today, smtp);
    }
}
