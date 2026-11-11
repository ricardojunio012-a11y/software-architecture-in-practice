// The "api" version: sets up the database, starts the API, sends the requests in the
// script and checks each response against the contract openapi/v1.yaml.
package morada;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpRequest.BodyPublishers;
import java.net.http.HttpResponse.BodyHandlers;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import morada.api.Api;
import morada.api.Database;
import morada.contract.OpenApi;
import morada.contract.Validate;

public class Script {

    public static void main(String[] args) throws Exception {
        Path data = Path.of(args[0]);
        String dbUrl = System.getenv("DATABASE_URL");
        Database.prepare(dbUrl, data.resolve("input/charges.json").toString());
        JsonNode contract = OpenApi.read(data.resolve("openapi/v1.yaml").toString());
        JsonNode requests = Api.JSON.readTree(
            data.resolve("input/requests.json").toFile()
        );
        var api = Api.create(dbUrl);
        String url = Api.start(api);
        var client = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .build();

        List<String> responses = new ArrayList<>();
        List<String> discrepancies = new ArrayList<>();
        int i = 0;
        for (JsonNode r : requests) {
            String method = r.get("method").asText();
            String path = r.get("path").asText();
            var request = HttpRequest.newBuilder(URI.create(url + path))
                .header("Content-Type", "application/json")
                .method(
                    method,
                    r.has("body")
                        ? BodyPublishers.ofString(Api.toJson(r.get("body")))
                        : BodyPublishers.noBody()
                );
            // Who is calling (in place of the access token) and the idempotency key
            List<String> extras = new ArrayList<>();
            if (r.has("managementCompany")) {
                String company = r.get("managementCompany").asText();
                request.header("Morada-Management-Company", company);
                extras.add("Morada-Management-Company: " + company);
            }
            if (r.has("key")) {
                request.header("Idempotency-Key", r.get("key").asText());
                extras.add("Idempotency-Key: " + r.get("key").asText());
            }
            var response = client.send(request.build(), BodyHandlers.ofString());
            String type = response.headers().firstValue("Content-Type").orElse("");
            JsonNode body = Api.JSON.readTree(response.body());
            String listed = extras.isEmpty()
                ? ""
                : " (" + String.join(", ", extras) + ")";
            responses.add(++i + ". " + r.get("description").asText());
            responses.add("   " + method + " " + path + listed);
            if (r.has("body")) responses.add("   " + Api.toJson(r.get("body")));
            responses.add("   → " + response.statusCode() + " " + type);
            responses.add("   " + Api.toJson(body));
            responses.add("");
            String withoutQuery = URI.create(url + path).getPath();
            int status = response.statusCode();
            discrepancies.addAll(
                Validate.validateResponse(
                    contract,
                    method,
                    withoutQuery,
                    status,
                    type,
                    body
                )
            );
        }
        api.stop(0);

        List<String> state = new ArrayList<>();
        try (var db = Database.connect(dbUrl); var sql = db.createStatement()) {
            var payments = sql.executeQuery(
                "SELECT id, charge, amount_cents FROM payments ORDER BY id"
            );
            List<String> lines = new ArrayList<>();
            while (payments.next()) {
                String line = "  %s: charge %s, %d cents".formatted(
                    payments.getString(1),
                    payments.getString(2),
                    payments.getInt(3)
                );
                lines.add(line);
            }
            state.add("payments recorded: " + lines.size());
            state.addAll(lines);
            var paid = sql.executeQuery(
                "SELECT id FROM charges WHERE status = 'paid' ORDER BY id"
            );
            List<String> ids = new ArrayList<>();
            while (paid.next()) ids.add(paid.getString(1));
            state.add("paid charges: " + String.join(", ", ids));
            var keys = sql.executeQuery(
                """
                SELECT management_company, string_agg(key, ', ' ORDER BY key)
                FROM idempotency_keys GROUP BY management_company
                ORDER BY management_company"""
            );
            state.add("stored idempotency keys:");
            while (keys.next()) {
                state.add("  " + keys.getString(1) + ": " + keys.getString(2));
            }
        }
        List<String> check = new ArrayList<>();
        check.add(requests.size() + " responses checked against openapi/v1.yaml");
        check.addAll(
            discrepancies.isEmpty() ? List.of("no discrepancies") : discrepancies
        );

        Path output = data.resolve("output/api");
        Files.createDirectories(output);
        Files.writeString(
            output.resolve("responses.txt"),
            String.join("\n", responses)
        );
        Files.writeString(output.resolve("state.txt"), String.join("\n", state) + "\n");
        Files.writeString(
            output.resolve("contract.txt"),
            String.join("\n", check) + "\n"
        );
        String summary = "api: %d requests, %d discrepancies".formatted(
            requests.size(),
            discrepancies.size()
        );
        System.out.println(summary);
    }
}
