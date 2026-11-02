// Usage: java morada.layers.Main <requests.json> <output-folder>
// Assembles the layers from the bottom up, starts the API on a free port of this
// machine only, and sends the requests, writing each response.
package morada.layers;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpRequest.BodyPublishers;
import java.net.http.HttpResponse.BodyHandlers;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import morada.layers.application.BookingService;
import morada.layers.data.ScheduleRepository;
import morada.layers.domain.Schedule.Space;
import morada.layers.presentation.Api;

public class Main {

    public static void main(String[] args) throws Exception {
        ObjectMapper json = new ObjectMapper();
        JsonNode data = json.readTree(Path.of(args[0]).toFile());
        List<Space> spaces = new ArrayList<>();
        for (JsonNode s : data.get("spaces")) {
            spaces.add(json.treeToValue(s, Space.class));
        }
        var api = Api.create(new BookingService(new ScheduleRepository(spaces)));
        api.start("127.0.0.1", 0);
        String base = "http://127.0.0.1:" + api.port();

        HttpClient client = HttpClient.newHttpClient();
        List<String> lines = new ArrayList<>();
        for (JsonNode r : data.get("requests")) {
            String method = r.get("method").asText();
            String path = r.get("path").asText();
            var body = r.has("body")
                ? BodyPublishers.ofString(json.writeValueAsString(r.get("body")))
                : BodyPublishers.noBody();
            var req = HttpRequest.newBuilder(URI.create(base + path))
                .header("Content-Type", "application/json")
                .method(method, body)
                .build();
            var response = client.send(req, BodyHandlers.ofString());
            String compact = json.writeValueAsString(json.readTree(response.body()));
            lines.add(
                method + " " + path + " -> " + response.statusCode() + " " + compact
            );
        }
        api.stop();

        Path output = Path.of(args[1]);
        Files.createDirectories(output);
        Files.writeString(
            output.resolve("responses.txt"),
            String.join("\n", lines) + "\n"
        );
        System.out.println(lines.size() + " requests; output in " + output);
    }
}
