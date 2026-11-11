// The "compatibility" version: compares each proposal in input/proposals with the
// published contract and says whether it can be published without breaking clients.
package morada;

import com.fasterxml.jackson.databind.JsonNode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import morada.contract.Compatibility;
import morada.contract.Compatibility.Change;
import morada.contract.OpenApi;

public class Proposals {

    public static void main(String[] args) throws Exception {
        Path data = Path.of(args[0]);
        JsonNode published = OpenApi.read(
            data.resolve("openapi/published/v1.yaml").toString()
        );
        Path folder = data.resolve("input/proposals");

        List<String> report = new ArrayList<>();
        int incompatible = 0;
        List<Path> proposals;
        try (var files = Files.list(folder)) {
            proposals = files.sorted().toList();
        }
        for (Path file : proposals) {
            List<Change> changes = Compatibility.compare(
                published,
                OpenApi.read(file.toString())
            );
            boolean breaks = changes.stream().anyMatch(c -> !c.compatible());
            if (breaks) incompatible++;
            String verdict = breaks ? "INCOMPATIBLE" : "compatible";
            report.add(file.getFileName() + ": " + verdict);
            for (Change c : changes) {
                report.add("  " + (c.compatible() ? "+" : "-") + " " + c.text());
            }
        }
        report.add("");
        String total = incompatible + " of " + proposals.size();
        report.add("incompatible proposals: " + total);

        Path output = data.resolve("output/compatibility");
        Files.createDirectories(output);
        Files.writeString(
            output.resolve("report.txt"),
            String.join("\n", report) + "\n"
        );
        System.out.println("compatibility: " + total + " incompatible");
    }
}
