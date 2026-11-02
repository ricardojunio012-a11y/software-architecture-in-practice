// Usage: java morada.before.Main <commands.json> <output-folder>
package morada.before;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import morada.before.Model.Booking;

public class Main {

    public static void main(String[] args) throws Exception {
        JsonNode data = new ObjectMapper().readTree(Path.of(args[0]).toFile());
        Map<String, JsonNode> spaces = new LinkedHashMap<>();
        for (JsonNode s : data.get("spaces")) spaces.put(s.get("id").asText(), s);
        List<String> events = new ArrayList<>();
        List<String> results = new ArrayList<>();
        for (JsonNode c : data.get("commands")) {
            String type = c.get("type").asText();
            String r = type.equals("book")
                ? Service.book(c, spaces.get(c.get("space").asText()), events)
                : Service.cancel(c, events);
            results.add(c.get("booking").asText() + ";" + type + ";" + r);
        }
        List<String> schedule = new ArrayList<>();
        for (String space : spaces.keySet()) {
            for (Booking b : Model.bookings) {
                if (b.space.equals(space) && b.status.equals("confirmed")) {
                    String slot = b.date + " " + Service.hours(b.start, b.end);
                    schedule.add(b.space + ";" + b.id + ";" + slot + ";" + b.unit);
                }
            }
        }

        Path output = Path.of(args[1]);
        Files.createDirectories(output);
        Map<String, List<String>> files = new LinkedHashMap<>();
        files.put("results", results);
        files.put("events", events);
        files.put("schedule", schedule);
        for (var f : files.entrySet()) {
            Files.writeString(
                output.resolve(f.getKey() + ".txt"),
                String.join("\n", f.getValue()) + "\n"
            );
        }
        System.out.println(results.size() + " commands executed; output in " + output);
    }
}
