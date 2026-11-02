// Original bookings module, written in a hurry for the first owners' meeting.
// DO NOT TOUCH without talking to George!!! (calculates weekend)
// Step 2: only the seams. Today's date and the email sender come in as parameters,
// with the old behavior as the default. Nothing else changed.
package morada.step2;

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

        void send(String to, String txt) {
            log.add("to " + to + ": " + txt);
        }
    }

    static Smtp smtp = new Smtp();

    public static void processBookings(String fn, String dir) throws Exception {
        processBookings(fn, dir, LocalDate.now(), smtp);
    }

    public static void processBookings(String fn, String dir, LocalDate td, Smtp mailer)
        throws Exception {
        JsonNode d = new ObjectMapper().readTree(new File(fn));
        List<String> out = new ArrayList<>();
        for (JsonNode r : d.get("requests")) {
            JsonNode u = null,
                s = null;
            for (JsonNode x : d.get("units"))
                if (x.get("id").asText().equals(r.get("unit").asText())) u = x;
            for (JsonNode x : d.get("spaces"))
                if (x.get("id").asText().equals(r.get("space").asText())) s = x;
            boolean ok = true;
            String msg = "";
            if (u.get("inArrears").asBoolean()) {
                ok = false;
                msg = "arrears";
            } else {
                long n = ChronoUnit.DAYS.between(
                    td,
                    LocalDate.parse(r.get("date").asText())
                );
                if (n < 2) {
                    ok = false;
                    msg = "short notice";
                } else {
                    for (JsonNode a : approved) {
                        if (
                            a.get("space").equals(r.get("space")) &&
                            a.get("date").equals(r.get("date"))
                        ) {
                            ok = false;
                            msg = "conflict";
                        }
                    }
                }
            }
            String ini =
                r.get("id").asText() +
                ";" +
                r.get("unit").asText() +
                ";" +
                r.get("space").asText() +
                ";" +
                r.get("date").asText();
            if (ok) {
                // calculates the amount
                long v = s.get("fee").asLong();
                if (
                    LocalDate.parse(r.get("date").asText()).getDayOfWeek() ==
                    DayOfWeek.SATURDAY
                ) v = v + (v * 20) / 100; // weekend
                if (r.get("guests").asInt() > 50) v = v + 5000;
                approved.add(r);
                String vv = v / 100 + "." + String.format("%02d", v % 100);
                out.add(ini + ";approved;" + vv);
                mailer.send(
                    u.get("email").asText(),
                    "Booking " + r.get("id").asText() + " confirmed. Amount: $" + vv
                );
            } else {
                out.add(ini + ";declined;" + msg);
                mailer.send(
                    u.get("email").asText(),
                    "Booking " + r.get("id").asText() + " declined (" + msg + ")"
                );
            }
        }
        Files.createDirectories(Path.of(dir));
        Files.writeString(Path.of(dir, "bookings.txt"), String.join("\n", out) + "\n");
        Files.writeString(Path.of(dir, "emails.txt"), String.join("\n", log) + "\n");
    }

    // Usage: java morada.step2.Main <input.json> <output-folder> [--today YYYY-MM-DD]
    public static void main(String[] args) throws Exception {
        LocalDate today =
            args.length > 3 && args[2].equals("--today")
                ? LocalDate.parse(args[3])
                : LocalDate.now();
        processBookings(args[0], args[1], today, smtp);
    }
}
