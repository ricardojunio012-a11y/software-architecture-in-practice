// Usage: java morada.plugins.Main <charges.json> <plugins-folder> <output-folder>
package morada.plugins;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import morada.plugins.BankPlugin.Charge;

public class Main {

    public static void main(String[] args) throws Exception {
        Core core = new Core();
        core.load(Path.of(args[1]));

        ObjectMapper json = new ObjectMapper();
        JsonNode charges = json.readTree(Path.of(args[0]).toFile()).get("charges");
        List<String> lines = new ArrayList<>();
        lines.add("plugins loaded: " + String.join(", ", core.names()));
        for (JsonNode c : charges) {
            lines.add(core.issue(json.treeToValue(c, Charge.class)));
        }

        Path output = Path.of(args[2]);
        Files.createDirectories(output);
        Files.writeString(output.resolve("batch.txt"), String.join("\n", lines) + "\n");
        System.out.println(charges.size() + " charges; output in " + output);
    }
}
