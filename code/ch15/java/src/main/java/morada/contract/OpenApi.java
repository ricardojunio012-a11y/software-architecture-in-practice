// Reading the OpenAPI contract: resolves references and finds the operation for a
// request.
package morada.contract;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import java.io.File;
import java.io.IOException;
import java.util.Iterator;

public final class OpenApi {

    private OpenApi() {}

    public static JsonNode read(String file) throws IOException {
        return new YAMLMapper().readTree(new File(file));
    }

    // Replaces {"$ref": "#/components/schemas/X"} with the node it points to
    public static JsonNode resolve(JsonNode contract, JsonNode node) {
        while (node != null && node.has("$ref")) {
            node = contract.at(node.get("$ref").asText().substring(1));
        }
        return node;
    }

    // The contract's path template that matches a concrete path
    public static String findPath(JsonNode contract, String path) {
        String[] parts = path.split("/", -1);
        Iterator<String> templates = contract.get("paths").fieldNames();
        while (templates.hasNext()) {
            String template = templates.next();
            String[] pieces = template.split("/", -1);
            if (pieces.length != parts.length) continue;
            boolean matches = true;
            for (int i = 0; i < pieces.length; i++) {
                matches =
                    matches &&
                    (pieces[i].startsWith("{") || pieces[i].equals(parts[i]));
            }
            if (matches) return template;
        }
        return null;
    }
}
