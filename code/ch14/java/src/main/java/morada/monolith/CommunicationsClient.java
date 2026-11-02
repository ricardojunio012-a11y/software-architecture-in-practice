// The client the monolith uses to talk to the Communications service: the
// consumer of the contract. It interprets the responses the service promises.
package morada.monolith;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpRequest.BodyPublishers;
import java.net.http.HttpResponse.BodyHandlers;
import java.util.Map;

public class CommunicationsClient {

    public record Result(boolean ok, boolean duplicate, String error) {}

    static final ObjectMapper JSON = new ObjectMapper();
    static final HttpClient CLIENT = HttpClient.newBuilder()
        .version(HttpClient.Version.HTTP_1_1)
        .build();

    private final String url;

    public CommunicationsClient(String url) {
        this.url = url;
    }

    public Result send(String id, String text) throws Exception {
        var request = HttpRequest.newBuilder(URI.create(url + "/notices"))
            .header("Content-Type", "application/json")
            .POST(
                BodyPublishers.ofString(
                    JSON.writeValueAsString(Map.of("id", id, "text", text))
                )
            )
            .build();
        var response = CLIENT.send(request, BodyHandlers.ofString());
        JsonNode body = JSON.readTree(response.body());
        if (response.statusCode() == 200) {
            return new Result(
                true,
                body.get("status").asText().equals("duplicate"),
                null
            );
        }
        return new Result(false, false, body.get("error").asText());
    }
}
