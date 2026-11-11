// Integration tests of idempotency against PostgreSQL: five simultaneous requests
// with the same key result in a single payment, and all of them get the same
// response; the same key at two management companies is two different requests.
package morada;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpRequest.BodyPublishers;
import java.net.http.HttpResponse;
import java.net.http.HttpResponse.BodyHandlers;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.stream.IntStream;
import morada.api.Api;
import morada.api.Database;
import org.junit.jupiter.api.Test;

class IdempotencyTest {

    static final HttpClient CLIENT = HttpClient.newBuilder()
        .version(HttpClient.Version.HTTP_1_1)
        .build();

    static HttpRequest pay(String url, String company, String charge, int amount) {
        String body = "{\"charge\":\"%s\",\"amountCents\":%d}".formatted(
            charge,
            amount
        );
        return HttpRequest.newBuilder(URI.create(url + "/v1/payments"))
            .header("Content-Type", "application/json")
            .header("Morada-Management-Company", company)
            .header("Idempotency-Key", "k-1")
            .POST(BodyPublishers.ofString(body))
            .build();
    }

    static long totalPayments(String dbUrl) throws Exception {
        try (var db = Database.connect(dbUrl); var sql = db.createStatement()) {
            var total = sql.executeQuery("SELECT count(*) FROM payments");
            total.next();
            return total.getLong(1);
        }
    }

    @Test
    void simultaneousRequestsWithTheSameKeyPayOnlyOnce() throws Exception {
        String dbUrl = System.getenv("DATABASE_URL");
        assumeTrue(dbUrl != null, "no database");
        Database.prepare(dbUrl, "/data/input/charges.json");
        var api = Api.create(dbUrl);
        String url = Api.start(api);
        var request = pay(url, "MC-A", "CH-04", 45000);
        List<HttpResponse<String>> responses = IntStream.range(0, 5)
            .mapToObj(i -> CLIENT.sendAsync(request, BodyHandlers.ofString()))
            .toList()
            .stream()
            .map(CompletableFuture::join)
            .toList();
        api.stop(0);
        assertEquals(
            List.of(201, 201, 201, 201, 201),
            responses.stream().map(HttpResponse::statusCode).toList()
        );
        // All of them get exactly the same response, with the same payment
        assertEquals(1, responses.stream().map(HttpResponse::body).distinct().count());
        assertEquals(1, totalPayments(dbUrl));
    }

    @Test
    void theSameKeyAtTwoManagementCompaniesDoesNotCollide() throws Exception {
        String dbUrl = System.getenv("DATABASE_URL");
        assumeTrue(dbUrl != null, "no database");
        Database.prepare(dbUrl, "/data/input/charges.json");
        var api = Api.create(dbUrl);
        String url = Api.start(api);
        var a = CLIENT.send(pay(url, "MC-A", "CH-04", 45000), BodyHandlers.ofString());
        var b = CLIENT.send(pay(url, "MC-B", "CH-05", 38000), BodyHandlers.ofString());
        api.stop(0);
        assertEquals(List.of(201, 201), List.of(a.statusCode(), b.statusCode()));
        assertEquals("CH-04", Api.JSON.readTree(a.body()).get("charge").asText());
        assertEquals("CH-05", Api.JSON.readTree(b.body()).get("charge").asText());
        assertEquals(2, totalPayments(dbUrl));
    }
}
