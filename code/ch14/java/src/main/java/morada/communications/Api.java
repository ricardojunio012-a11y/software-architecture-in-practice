// The HTTP API of the Communications service: the provider of the contract.
package morada.communications;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.Map;
import morada.communications.Communications.InvalidDataError;

public class Api {

    static final ObjectMapper JSON = new ObjectMapper();

    static {
        // Without this, the JDK HTTP server delays the responses (chapter 12)
        System.setProperty("sun.net.httpserver.nodelay", "true");
    }

    public static void respond(HttpExchange exchange, int status, Object body)
        throws IOException {
        byte[] data = JSON.writeValueAsBytes(body);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, data.length);
        exchange.getResponseBody().write(data);
        exchange.close();
    }

    public static HttpServer create(Communications communications) throws IOException {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/notices", exchange -> {
            JsonNode notice = JSON.readTree(exchange.getRequestBody());
            String id = notice.get("id").asText();
            try {
                String status = communications.send(id, notice.get("text").asText());
                respond(exchange, 200, Map.of("notice", id, "status", status));
            } catch (InvalidDataError error) {
                respond(exchange, 400, Map.of("error", error.getMessage()));
            }
        });
        return server;
    }

    // Starts the server and returns its address
    public static String start(HttpServer server) {
        server.start();
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }
}
