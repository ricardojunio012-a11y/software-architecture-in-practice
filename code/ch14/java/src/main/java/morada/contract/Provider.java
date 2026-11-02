// Provider-side contract verification. Reads the contract the consumer published,
// sets up the state each interaction asks for, sends the request to the real
// Communications API and compares the response with the agreed one.
package morada.contract;

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
import java.util.Map;
import java.util.function.Consumer;
import morada.communications.Api;
import morada.communications.Communications;
import morada.communications.Communications.InMemoryNotices;

public class Provider {

    // The response satisfies the contract if it has the agreed status and the fields
    // the consumer declared. Extra fields break no one.
    static boolean satisfies(JsonNode actual, JsonNode expected) {
        if (actual.get("status").asInt() != expected.get("status").asInt()) {
            return false;
        }
        var fields = expected.get("body").fields();
        while (fields.hasNext()) {
            var field = fields.next();
            if (!field.getValue().equals(actual.get("body").get(field.getKey()))) {
                return false;
            }
        }
        return true;
    }

    public static void main(String[] args) throws Exception {
        var json = new ObjectMapper();
        JsonNode contract = json.readTree(
            Path.of(args[0], "consumer", "contract.json").toFile()
        );
        var client = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .build();

        // Each state in the contract has a setup on the provider side
        Map<String, Consumer<Communications>> states = Map.of(
            "no notice has been sent",
            c -> {},
            "notice E-P-001 has already been sent",
            c -> c.send("E-P-001", "payment received")
        );

        List<String> report = new ArrayList<>();
        for (JsonNode interaction : contract.get("interactions")) {
            var communications = new Communications(new InMemoryNotices());
            states.get(interaction.get("state").asText()).accept(communications);
            var api = Api.create(communications);
            String url = Api.start(api);
            JsonNode request = interaction.get("request");
            var httpRequest = HttpRequest.newBuilder(
                URI.create(url + request.get("path").asText())
            )
                .header("Content-Type", "application/json")
                .method(
                    request.get("method").asText(),
                    BodyPublishers.ofString(
                        json.writeValueAsString(request.get("body"))
                    )
                )
                .build();
            var response = client.send(httpRequest, BodyHandlers.ofString());
            api.stop(0);
            var actual = json.createObjectNode();
            actual.put("status", response.statusCode());
            actual.set("body", json.readTree(response.body()));
            String description = interaction.get("description").asText();
            JsonNode agreed = interaction.get("response");
            String failure =
                "FAILED (expected " + agreed + ", received " + actual + ")";
            report.add(
                description + ": " + (satisfies(actual, agreed) ? "verified" : failure)
            );
        }

        Path folder = Path.of(args[0], "provider");
        Files.createDirectories(folder);
        Files.writeString(
            folder.resolve("report.txt"),
            String.join("\n", report) + "\n"
        );
        int verified = report.size();
        System.out.println("provider: " + verified + " interactions verified");
        System.exit(report.stream().anyMatch(l -> l.contains("FAILED")) ? 1 : 0);
    }
}
