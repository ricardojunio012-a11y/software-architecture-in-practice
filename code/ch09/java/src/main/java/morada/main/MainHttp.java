// Usage: java morada.main.MainHttp memory|postgres <output-folder>
// Starts the HTTP adapter on a free port, with the chosen repository, sends the
// requests and writes the responses and the final state of the schedules.
package morada.main;

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
import morada.adapters.inbound.Http;

public class MainHttp {

    public static void main(String[] args) throws Exception {
        String repository = args[0];
        var assembled = Assemble.assemble(repository, true);
        var api = Http.createApi(assembled.service());
        api.start("127.0.0.1", 0);
        String base = "http://127.0.0.1:" + api.port();

        var json = new ObjectMapper();
        JsonNode data = json.readTree(Path.of("/data/input/requests.json").toFile());
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
        List<String> state = new ArrayList<>();
        for (var s : assembled.schedules().all()) {
            for (var b : s.bookings()) {
                state.add(String.join(";", s.space().id(), b.id(), b.unit(), b.slot()));
            }
        }

        Path output = Path.of(args[1]);
        Files.createDirectories(output);
        Files.writeString(
            output.resolve("responses.txt"),
            String.join("\n", lines) + "\n"
        );
        Files.writeString(
            output.resolve("schedules.txt"),
            String.join("\n", state) + "\n"
        );
        System.out.println(
            lines.size() + " requests (" + repository + "); output in " + output
        );
    }
}
