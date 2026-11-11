// Checks a real response against the contract: the status must be documented, so
// must the content type, and the body must follow the schema.
package morada.contract;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public final class Validate {

    private Validate() {}

    static String typeOf(JsonNode value) {
        if (value.isNull()) return "null";
        if (value.isBoolean()) return "boolean";
        if (value.isIntegralNumber()) return "integer";
        if (value.isNumber()) return "number";
        if (value.isTextual()) return "string";
        if (value.isArray()) return "array";
        return "object";
    }

    static List<String> types(JsonNode schema) {
        List<String> types = new ArrayList<>();
        JsonNode type = schema.get("type");
        if (type == null) return types;
        if (type.isArray()) type.forEach(t -> types.add(t.asText()));
        else types.add(type.asText());
        return types;
    }

    static boolean contains(JsonNode list, JsonNode value) {
        for (JsonNode item : list) if (item.equals(value)) return true;
        return false;
    }

    static List<String> validateSchema(
        JsonNode contract,
        JsonNode schema,
        JsonNode value,
        String at
    ) {
        schema = OpenApi.resolve(contract, schema);
        List<String> types = types(schema);
        String type = typeOf(value);
        if (!types.isEmpty() && !types.contains(type)) {
            return List.of(
                at + ": expected " + String.join(" or ", types) + ", got " + type
            );
        }
        if (schema.has("enum") && !contains(schema.get("enum"), value)) {
            return List.of(at + ": value not in enum: " + value.asText());
        }
        List<String> errors = new ArrayList<>();
        if (type.equals("object")) {
            for (JsonNode field : schema.path("required")) {
                if (!value.has(field.asText())) {
                    errors.add(at + "." + field.asText() + ": required field missing");
                }
            }
            for (Map.Entry<String, JsonNode> field : schema
                .path("properties")
                .properties()) {
                String name = field.getKey();
                if (value.has(name)) {
                    String inside = at + "." + name;
                    errors.addAll(
                        validateSchema(
                            contract,
                            field.getValue(),
                            value.get(name),
                            inside
                        )
                    );
                }
            }
        }
        if (type.equals("array") && schema.has("items")) {
            for (int i = 0; i < value.size(); i++) {
                String inside = at + "[" + i + "]";
                errors.addAll(
                    validateSchema(contract, schema.get("items"), value.get(i), inside)
                );
            }
        }
        return errors;
    }

    public static List<String> validateResponse(
        JsonNode contract,
        String method,
        String path,
        int status,
        String type,
        JsonNode body
    ) {
        String template = OpenApi.findPath(contract, path);
        JsonNode operation =
            template == null
                ? null
                : contract.get("paths").get(template).get(method.toLowerCase());
        if (operation == null) {
            return List.of(method + " " + path + ": operation not in the contract");
        }
        String name = method + " " + template + " " + status;
        JsonNode response = OpenApi.resolve(
            contract,
            operation.get("responses").get(String.valueOf(status))
        );
        if (response == null) return List.of(name + ": status not documented");
        JsonNode content = response.path("content").get(type);
        if (content == null) {
            return List.of(name + ": content type not documented: " + type);
        }
        return validateSchema(contract, content.get("schema"), body, "$")
            .stream()
            .map(error -> name + ": " + error)
            .toList();
    }
}
