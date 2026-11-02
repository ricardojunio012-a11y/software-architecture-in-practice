// Usage: java morada.before.Main <input.json> <output-folder> [--today YYYY-MM-DD]
package morada.before;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import morada.before.config.Config;
import morada.before.services.Services;

public class Main {

    public static void main(String[] args) throws Exception {
        Config.today =
            args.length > 3 && args[2].equals("--today")
                ? LocalDate.parse(args[3])
                : LocalDate.now();
        Config.data = new ObjectMapper().readTree(Path.of(args[0]).toFile());
        Services.calculateAll();

        // The order matters: the delinquency report reorders the list of charges
        Path output = Files.createDirectories(Path.of(args[1]));
        for (String type : List.of("charges", "delinquency", "financial-report")) {
            Files.writeString(
                output.resolve(type + ".txt"),
                Services.generateOutput(type)
            );
        }
        System.out.println("reports generated in " + args[1]);
    }
}
