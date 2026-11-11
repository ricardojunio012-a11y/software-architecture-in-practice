// Compares the published contract with a proposal and lists the changes.
// Incompatible is whatever can break a client that already works: removing something
// it uses, changing what it receives or requiring something it does not send.
package morada.contract;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class Compatibility {

    public record Change(boolean compatible, String text) {}

    private final JsonNode old;
    private final JsonNode proposed;
    private final List<Change> changes = new ArrayList<>();

    private Compatibility(JsonNode old, JsonNode proposed) {
        this.old = old;
        this.proposed = proposed;
    }

    void note(boolean compatible, String text) {
        changes.add(new Change(compatible, text));
    }

    static List<String> texts(JsonNode list) {
        List<String> values = new ArrayList<>();
        list.forEach(v -> values.add(v.asText()));
        return values;
    }

    void schemas(JsonNode a, JsonNode b, String side, String label, String field) {
        a = OpenApi.resolve(old, a);
        b = OpenApi.resolve(proposed, b);
        String name = field.isEmpty() ? "(root)" : field;
        String typeA = String.join(" or ", Validate.types(a));
        String typeB = String.join(" or ", Validate.types(b));
        if (!typeA.equals(typeB)) {
            String changed = name + " (" + typeA + " → " + typeB + ")";
            note(false, label + ": type changed: " + changed);
            return;
        }
        if (a.has("enum") && b.has("enum")) {
            // A new value in the response breaks whoever handles every case; a value
            // fewer in the request breaks whoever sends it
            boolean response = side.equals("response");
            List<String> from = texts(response ? a.get("enum") : b.get("enum"));
            List<String> to = texts(response ? b.get("enum") : a.get("enum"));
            String warning = response ? "new enum value" : "enum value removed";
            for (String value : to) {
                if (!from.contains(value)) {
                    note(false, label + ": " + warning + ": " + name + " = " + value);
                }
            }
        }
        JsonNode propsA = a.path("properties");
        JsonNode propsB = b.path("properties");
        List<String> reqA = texts(a.path("required"));
        List<String> reqB = texts(b.path("required"));
        for (Map.Entry<String, JsonNode> p : propsA.properties()) {
            String pName = p.getKey();
            String inside = field.isEmpty() ? pName : field + "." + pName;
            if (!propsB.has(pName)) {
                note(false, label + ": field removed: " + inside);
                continue;
            }
            boolean guaranteedBefore = reqA.contains(pName);
            boolean guaranteedAfter = reqB.contains(pName);
            if (side.equals("response") && guaranteedBefore && !guaranteedAfter) {
                note(false, label + ": field no longer guaranteed: " + inside);
            }
            if (side.equals("request") && !guaranteedBefore && guaranteedAfter) {
                note(false, label + ": field became required: " + inside);
            }
            schemas(p.getValue(), propsB.get(pName), side, label, inside);
        }
        for (Map.Entry<String, JsonNode> p : propsB.properties()) {
            String pName = p.getKey();
            if (propsA.has(pName)) continue;
            String inside = field.isEmpty() ? pName : field + "." + pName;
            if (side.equals("response")) {
                note(true, label + ": new field: " + inside);
            } else if (reqB.contains(pName)) {
                note(false, label + ": new required field: " + inside);
            } else {
                note(true, label + ": new optional field: " + inside);
            }
        }
        if (a.has("items") && b.has("items")) {
            schemas(a.get("items"), b.get("items"), side, label, field + "[]");
        }
    }

    static String key(JsonNode parameter) {
        return parameter.get("in").asText() + " " + parameter.get("name").asText();
    }

    void parameters(JsonNode a, JsonNode b, String name) {
        Map<String, JsonNode> added = new LinkedHashMap<>();
        b.forEach(p -> added.put(key(p), p));
        List<String> existing = new ArrayList<>();
        for (JsonNode pa : a) {
            existing.add(key(pa));
            String pName = pa.get("name").asText();
            JsonNode pb = added.get(key(pa));
            if (pb == null) {
                note(false, name + ": parameter removed: " + pName);
                continue;
            }
            if (!pa.path("required").asBoolean() && pb.path("required").asBoolean()) {
                note(false, name + ": parameter became required: " + pName);
            }
            String label = name + " parameter " + pName;
            schemas(pa.get("schema"), pb.get("schema"), "request", label, "");
        }
        for (JsonNode pb : b) {
            if (existing.contains(key(pb))) continue;
            String pName = pb.get("name").asText();
            if (pb.path("required").asBoolean()) {
                note(false, name + ": new required parameter: " + pName);
            } else {
                note(true, name + ": new optional parameter: " + pName);
            }
        }
    }

    void operation(JsonNode a, JsonNode b, String name) {
        parameters(a.path("parameters"), b.path("parameters"), name);
        JsonNode requestA = a.at("/requestBody/content/application~1json/schema");
        JsonNode requestB = b.at("/requestBody/content/application~1json/schema");
        if (!requestA.isMissingNode() && !requestB.isMissingNode()) {
            schemas(requestA, requestB, "request", name + " request", "");
        }
        for (Map.Entry<String, JsonNode> r : a.get("responses").properties()) {
            String status = r.getKey();
            if (!b.get("responses").has(status)) continue;
            JsonNode contentA = content(old, r.getValue());
            JsonNode contentB = content(proposed, b.get("responses").get(status));
            for (Map.Entry<String, JsonNode> media : contentA.properties()) {
                if (!contentB.has(media.getKey())) continue;
                JsonNode schemaB = contentB.get(media.getKey()).get("schema");
                JsonNode schemaA = media.getValue().get("schema");
                schemas(schemaA, schemaB, "response", name + " " + status, "");
            }
        }
    }

    static JsonNode content(JsonNode contract, JsonNode response) {
        JsonNode resolved = OpenApi.resolve(contract, response);
        return resolved.has("content")
            ? resolved.get("content")
            : MissingNode.getInstance();
    }

    public static List<Change> compare(JsonNode old, JsonNode proposed) {
        var c = new Compatibility(old, proposed);
        for (Map.Entry<String, JsonNode> path : old.get("paths").properties()) {
            for (Map.Entry<String, JsonNode> op : path.getValue().properties()) {
                String name = op.getKey().toUpperCase() + " " + path.getKey();
                JsonNode newOp = proposed
                    .get("paths")
                    .path(path.getKey())
                    .get(op.getKey());
                if (newOp != null) c.operation(op.getValue(), newOp, name);
                else c.note(false, name + ": operation removed");
            }
        }
        for (Map.Entry<String, JsonNode> path : proposed.get("paths").properties()) {
            for (Map.Entry<String, JsonNode> op : path.getValue().properties()) {
                if (old.get("paths").path(path.getKey()).get(op.getKey()) == null) {
                    String name = op.getKey().toUpperCase() + " " + path.getKey();
                    c.note(true, name + ": new operation");
                }
            }
        }
        return c.changes;
    }
}
