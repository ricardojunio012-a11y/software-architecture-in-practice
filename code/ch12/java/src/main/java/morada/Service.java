// The Communications service: the same module, now behind an HTTP API, in its own
// process and container. With FAILURES=yes, it fails on purpose: every 25th call
// it rejects the request, and every 40th call it sends the notice but "loses" the
// response.
package morada;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

public class Service {

    static final boolean FAIL = "yes".equals(System.getenv("FAILURES"));
    static final ObjectMapper JSON = new ObjectMapper();
    static Communications communications = new Communications();
    static int calls = 0;

    static void reply(HttpExchange exchange, int status, String body)
        throws IOException {
        byte[] data = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, data.length);
        exchange.getResponseBody().write(data);
        exchange.close();
    }

    public static void main(String[] args) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(8080), 0);
        server.createContext("/health", exchange -> reply(exchange, 200, "{}"));
        // Lab only: start each run from scratch
        server.createContext("/reset", exchange -> {
            communications = new Communications();
            calls = 0;
            reply(exchange, 200, "{}");
        });
        server.createContext("/notices", exchange -> {
            JsonNode notice = JSON.readTree(exchange.getRequestBody());
            calls++;
            if (FAIL && calls % 25 == 0) {
                reply(exchange, 503, "{\"error\":\"unavailable\"}");
                return;
            }
            boolean sent = communications.send(
                notice.get("id").asText(),
                notice.get("text").asText()
            );
            if (FAIL && calls % 40 == 0) {
                reply(exchange, 503, "{\"error\":\"timed out\"}");
                return;
            }
            var response = JSON.createObjectNode()
                .put("notice", notice.get("id").asText())
                .put("status", sent ? "sent" : "duplicate");
            reply(exchange, 200, JSON.writeValueAsString(response));
        });
        server.start();
        System.out.println("Communications listening on port 8080");
    }
}
