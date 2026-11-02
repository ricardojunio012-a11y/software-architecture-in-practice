// Step 7: the strangler fig. A facade receives every request and decides, space by
// space, who answers: the old code (step 6) or the new one (NewCode.java).
// Usage: java morada.step7.Main <input.json> <output-folder> [--today YYYY-MM-DD]
package morada.step7;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import morada.step5.Bookings;

public class Main {

    // The route of each space. "experiment": the old code answers and the new one runs
    // alongside, only to compare. With each validated slice, one space changes route;
    // in the end, the old code leaves.
    static final Map<String, String> ROUTES = Map.of(
        "party-room",
        "new",
        "grill-area",
        "experiment"
    );

    static String routeOf(JsonNode request) {
        return ROUTES.getOrDefault(request.get("space").asText(), "old");
    }

    record Answer(String line, String email) {}

    static final ObjectMapper JSON = new ObjectMapper();

    // The old code was not made to be called like this: it takes a file and writes
    // another. The facade adapts to it, through the step 2 seams, without changing a
    // line of it.
    static Map<String, Answer> oldCode(JsonNode data, LocalDate today)
        throws Exception {
        Path dir = Files.createTempDirectory("old-");
        Path file = dir.resolve("requests.json");
        JSON.writeValue(file.toFile(), data);
        List<String> emails = new ArrayList<>();
        var mailer = new morada.step6.Main.Smtp() {
            @Override
            public void send(String to, String text) {
                emails.add("to " + to + ": " + text);
            }
        };
        morada.step6.Main.processBookings(
            file.toString(),
            dir.toString(),
            today,
            mailer
        );
        List<String> lines = Files.readAllLines(dir.resolve("bookings.txt"));
        Map<String, Answer> answers = new HashMap<>();
        int i = 0;
        for (JsonNode r : data.get("requests")) {
            answers.put(r.get("id").asText(), new Answer(lines.get(i), emails.get(i)));
            i++;
        }
        return answers;
    }

    static Map<String, Answer> newCode(JsonNode data, LocalDate today)
        throws Exception {
        var decisions = NewCode.decide(
            JSON.treeToValue(data, Bookings.Data.class),
            today
        );
        List<String> lines = Bookings.report(decisions);
        var notices = Bookings.notices(decisions);
        Map<String, Answer> answers = new HashMap<>();
        for (int i = 0; i < decisions.size(); i++) {
            String email = "to " + notices.get(i).to() + ": " + notices.get(i).text();
            answers.put(
                decisions.get(i).request().id(),
                new Answer(lines.get(i), email)
            );
        }
        return answers;
    }

    static JsonNode only(JsonNode data, Set<String> routes) {
        ObjectNode copy = data.deepCopy();
        var requests = copy.putArray("requests");
        for (JsonNode r : data.get("requests"))
            if (routes.contains(routeOf(r))) requests.add(r);
        return copy;
    }

    public static void main(String[] args) throws Exception {
        LocalDate today =
            args.length > 3 && args[2].equals("--today")
                ? LocalDate.parse(args[3])
                : LocalDate.now();
        JsonNode data = JSON.readTree(Path.of(args[0]).toFile());
        var fromOld = oldCode(only(data, Set.of("old", "experiment")), today);
        var fromNew = newCode(only(data, Set.of("new", "experiment")), today);

        // The experiment compares the two answers, but the old code is what answers
        // residents
        List<String> compared = new ArrayList<>();
        for (JsonNode r : data.get("requests")) {
            if (routeOf(r).equals("experiment")) compared.add(r.get("id").asText());
        }
        List<String> mismatched = compared
            .stream()
            .filter(id -> !fromOld.get(id).equals(fromNew.get(id)))
            .toList();
        String counts = compared.size() + " requests compared, ";
        System.out.println(
            "experiment: " + counts + mismatched.size() + " with differences"
        );
        for (String id : mismatched) {
            String o = fromOld.get(id).line();
            String nw = fromNew.get(id).line();
            System.out.println("  " + id + ": old " + o + " | new " + nw);
        }

        List<String> bookings = new ArrayList<>();
        List<String> emails = new ArrayList<>();
        for (JsonNode r : data.get("requests")) {
            var a = (routeOf(r).equals("new") ? fromNew : fromOld).get(
                r.get("id").asText()
            );
            bookings.add(a.line());
            emails.add(a.email());
        }
        Path output = Path.of(args[1]);
        Files.createDirectories(output);
        Files.writeString(
            output.resolve("bookings.txt"),
            String.join("\n", bookings) + "\n"
        );
        Files.writeString(
            output.resolve("emails.txt"),
            String.join("\n", emails) + "\n"
        );
    }
}
