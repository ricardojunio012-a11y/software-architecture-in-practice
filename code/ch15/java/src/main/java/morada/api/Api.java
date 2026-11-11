// Morada's public API for management companies. Errors follow RFC 9457 (problem
// details), the listing is paginated by cursor and the payment requires an
// idempotency key in the Idempotency-Key header. Each management company sees only
// the communities it manages.
package morada.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;

public class Api {

    public static final ObjectMapper JSON = new ObjectMapper();
    static final String PROBLEMS = "https://api.morada.example/problems/";
    static final String ASK_FOR_KEY =
        "send the Idempotency-Key header with a unique request identifier";
    static final String ASK_FOR_TOKEN =
        "send the access token (here, the Morada-Management-Company header)";
    static final Pattern CHARGES_ROUTE = Pattern.compile(
        "^/v1/communities/([^/]+)/charges$"
    );

    static {
        // Without this, the JDK's HTTP server delays the responses (chapter 12)
        System.setProperty("sun.net.httpserver.nodelay", "true");
    }

    public record Response(int status, JsonNode body) {}

    static class Problem extends Exception {

        final int status;
        final String type;
        final String title;

        Problem(int status, String type, String title, String detail) {
            super(detail);
            this.status = status;
            this.type = type;
            this.title = title;
        }

        Response response() {
            ObjectNode body = JSON.createObjectNode();
            body.put("type", PROBLEMS + type);
            body.put("title", title);
            body.put("status", status);
            body.put("detail", getMessage());
            return new Response(status, body);
        }
    }

    public static String toJson(Object data) {
        try {
            return JSON.writeValueAsString(data);
        } catch (IOException error) {
            throw new IllegalStateException(error);
        }
    }

    // The cursor is opaque to the client: the page's last identifier, in base64url
    static String cursorOf(String id) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(id.getBytes());
    }

    static String idOfCursor(String cursor) {
        return new String(Base64.getUrlDecoder().decode(cursor));
    }

    static Response listCharges(
        Connection db,
        String company,
        String community,
        Map<String, String> query
    ) throws SQLException, Problem {
        String received = query.getOrDefault("limit", "20");
        int limit = received.matches("\\d{1,9}") ? Integer.parseInt(received) : 0;
        if (limit < 1 || limit > 100) {
            throw new Problem(
                400,
                "invalid-limit",
                "Invalid limit",
                "limit must be between 1 and 100, got " + received
            );
        }
        String status = query.get("status");
        if (status != null && !List.of("open", "paid").contains(status)) {
            throw new Problem(
                400,
                "invalid-status",
                "Invalid status",
                "status must be open or paid, got " + status
            );
        }
        // Object-level authorization: another management company's community answers
        // as if it did not exist, so as not to reveal even that it exists
        var exists = db.prepareStatement(
            "SELECT 1 FROM communities WHERE id = ? AND management_company = ?"
        );
        exists.setString(1, community);
        exists.setString(2, company);
        if (!exists.executeQuery().next()) {
            throw new Problem(
                404,
                "community-not-found",
                "Community not found",
                "community " + community + " does not exist"
            );
        }
        String cursor = query.get("cursor");
        String after = cursor != null ? idOfCursor(cursor) : "";
        // One row more than the limit says whether there is a next page
        var sql = db.prepareStatement(
            """
            SELECT id, unit, due_date::text, amount_cents, status
            FROM charges
            WHERE community = ? AND (?::text IS NULL OR status = ?) AND id > ?
            ORDER BY id LIMIT ?"""
        );
        sql.setString(1, community);
        sql.setString(2, status);
        sql.setString(3, status);
        sql.setString(4, after);
        sql.setInt(5, limit + 1);
        var rows = sql.executeQuery();
        var data = JSON.createArrayNode();
        boolean hasMore = false;
        while (rows.next()) {
            if (data.size() == limit) {
                hasMore = true;
                break;
            }
            ObjectNode c = data.addObject();
            c.put("id", rows.getString(1));
            c.put("unit", rows.getString(2));
            c.put("dueDate", rows.getString(3));
            c.put("amountCents", rows.getInt(4));
            c.put("status", rows.getString(5));
        }
        ObjectNode page = JSON.createObjectNode();
        page.set("data", data);
        String last = data.isEmpty()
            ? null
            : data
                  .get(data.size() - 1)
                  .get("id")
                  .asText();
        page.put("next", hasMore ? cursorOf(last) : null);
        return new Response(200, page);
    }

    // The payment rules, inside the transaction opened by recordPayment
    static Response pay(Connection db, String company, String charge, int amount)
        throws SQLException, Problem {
        // The charge must belong to one of the management company's own communities
        var query = db.prepareStatement(
            """
            SELECT amount_cents, status FROM charges
            WHERE id = ? AND community IN
              (SELECT id FROM communities WHERE management_company = ?)
            FOR UPDATE"""
        );
        query.setString(1, charge);
        query.setString(2, company);
        var row = query.executeQuery();
        if (!row.next()) {
            throw new Problem(
                422,
                "charge-not-found",
                "Charge not found",
                "charge " + charge + " does not exist"
            );
        }
        if (row.getString("status").equals("paid")) {
            throw new Problem(
                409,
                "charge-already-paid",
                "Charge already paid",
                "charge " + charge + " has already been paid"
            );
        }
        int due = row.getInt("amount_cents");
        if (due != amount) {
            String detail =
                "charge %s is %d cents, and the payment stated %d".formatted(
                    charge,
                    due,
                    amount
                );
            throw new Problem(422, "amount-mismatch", "Amount mismatch", detail);
        }
        var sequence = db
            .createStatement()
            .executeQuery(
                "SELECT 'PAY-' || lpad(nextval('payments_seq')::text, 4, '0')"
            );
        sequence.next();
        String id = sequence.getString(1);
        var payment = db.prepareStatement("INSERT INTO payments VALUES (?, ?, ?)");
        payment.setString(1, id);
        payment.setString(2, charge);
        payment.setInt(3, amount);
        payment.executeUpdate();
        var paid = db.prepareStatement(
            "UPDATE charges SET status = 'paid' WHERE id = ?"
        );
        paid.setString(1, charge);
        paid.executeUpdate();
        ObjectNode body = JSON.createObjectNode();
        body.put("id", id);
        body.put("charge", charge);
        body.put("amountCents", amount);
        body.put("status", "confirmed");
        return new Response(201, body);
    }

    // Idempotency key: the key and the response are stored in the same transaction
    // as the payment. Retrying the request returns the stored response, without
    // paying again. The key is scoped to a management company: two companies may
    // generate the same one.
    static Response recordPayment(
        Connection db,
        String company,
        String key,
        JsonNode body
    ) throws Exception {
        if (key == null || key.isEmpty()) {
            throw new Problem(
                400,
                "missing-key",
                "Missing idempotency key",
                ASK_FOR_KEY
            );
        }
        if (!body.path("charge").isTextual() || !body.path("amountCents").isInt()) {
            throw new Problem(
                400,
                "invalid-request",
                "Invalid request",
                "provide charge (string) and amountCents (integer)"
            );
        }
        // The canonical form of the request: only the fields the operation uses,
        // always in the same order. The field order in the client's JSON does not
        // change the comparison.
        ObjectNode request = JSON.createObjectNode();
        request.put("charge", body.get("charge").asText());
        request.put("amountCents", body.get("amountCents").asInt());
        db.setAutoCommit(false);
        try {
            // Whoever stores the key first processes the request. A simultaneous
            // request with the same key waits here for the first to finish and finds
            // the response.
            var inserted = db.prepareStatement(
                "INSERT INTO idempotency_keys (management_company, key, request) " +
                    "VALUES (?, ?, ?) ON CONFLICT DO NOTHING"
            );
            inserted.setString(1, company);
            inserted.setString(2, key);
            inserted.setString(3, toJson(request));
            if (inserted.executeUpdate() == 0) {
                var query = db.prepareStatement(
                    "SELECT request, status, response FROM idempotency_keys " +
                        "WHERE management_company = ? AND key = ?"
                );
                query.setString(1, company);
                query.setString(2, key);
                var previous = query.executeQuery();
                previous.next();
                db.commit();
                if (!previous.getString("request").equals(toJson(request))) {
                    throw new Problem(
                        422,
                        "key-reused",
                        "Idempotency key reused",
                        "key " + key + " was already used with a different request"
                    );
                }
                JsonNode stored = JSON.readTree(previous.getString("response"));
                return new Response(previous.getInt("status"), stored);
            }
            Response response;
            try {
                int amount = request.get("amountCents").asInt();
                String charge = request.get("charge").asText();
                response = pay(db, company, charge, amount);
            } catch (Problem problem) {
                response = problem.response();
            }
            var store = db.prepareStatement(
                """
                UPDATE idempotency_keys SET status = ?, response = ?
                WHERE management_company = ? AND key = ?"""
            );
            store.setInt(1, response.status());
            store.setString(2, toJson(response.body()));
            store.setString(3, company);
            store.setString(4, key);
            store.executeUpdate();
            db.commit();
            return response;
        } catch (Exception error) {
            db.rollback();
            throw error;
        }
    }

    static Map<String, String> query(String text) {
        Map<String, String> parameters = new HashMap<>();
        if (text == null) return parameters;
        for (String pair : text.split("&")) {
            String[] parts = pair.split("=", 2);
            String value = parts.length > 1 ? parts[1] : "";
            parameters.put(parts[0], URLDecoder.decode(value, StandardCharsets.UTF_8));
        }
        return parameters;
    }

    static Response handle(Connection db, HttpExchange exchange) throws Exception {
        String method = exchange.getRequestMethod();
        String path = exchange.getRequestURI().getPath();
        try {
            // In production, the gateway validates the OAuth 2.0 token and passes on
            // the management company that owns the token. In the lab, the
            // Morada-Management-Company header plays that role, and whoever sends it
            // is treated as authenticated.
            var headers = exchange.getRequestHeaders();
            String company = headers.getFirst("Morada-Management-Company");
            if (company == null || company.isEmpty()) {
                throw new Problem(
                    401,
                    "unauthenticated",
                    "Client not identified",
                    ASK_FOR_TOKEN
                );
            }
            var charges = CHARGES_ROUTE.matcher(path);
            if (method.equals("GET") && charges.matches()) {
                var parameters = query(exchange.getRequestURI().getRawQuery());
                String community = charges.group(1);
                return listCharges(db, company, community, parameters);
            }
            if (method.equals("POST") && path.equals("/v1/payments")) {
                String key = headers.getFirst("Idempotency-Key");
                JsonNode body = JSON.readTree(exchange.getRequestBody());
                return recordPayment(db, company, key, body);
            }
            throw new Problem(
                404,
                "route-not-found",
                "Route not found",
                "there is no " + method + " " + path
            );
        } catch (Problem problem) {
            return problem.response();
        }
    }

    public static HttpServer create(String dbUrl) throws IOException {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        // One virtual thread per request, each with its own database connection
        server.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
        server.createContext("/", exchange -> {
            Response response;
            try (var db = Database.connect(dbUrl)) {
                response = handle(db, exchange);
            } catch (Exception error) {
                throw new IOException(error);
            }
            byte[] data = toJson(response.body()).getBytes(StandardCharsets.UTF_8);
            String type =
                response.status() >= 400
                    ? "application/problem+json"
                    : "application/json";
            exchange.getResponseHeaders().set("Content-Type", type);
            // The 401 tells the client how to authenticate (RFC 9110)
            if (response.status() == 401) {
                exchange.getResponseHeaders().set("WWW-Authenticate", "Bearer");
            }
            exchange.sendResponseHeaders(response.status(), data.length);
            exchange.getResponseBody().write(data);
            exchange.close();
        });
        return server;
    }

    // Starts the server and returns its address
    public static String start(HttpServer server) {
        server.start();
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }
}
