// Usage: java morada.step3.Main <input.json> <output-folder> [--today YYYY-MM-DD]
// The only place that knows about files, the clock and concrete implementations.
package morada.step3;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;

public class Main {

    public static void main(String[] args) throws Exception {
        LocalDate today =
            args.length > 3 && args[2].equals("--today")
                ? LocalDate.parse(args[3])
                : LocalDate.now();
        CommunityData data = new ObjectMapper().readValue(
            Path.of(args[0]).toFile(),
            CommunityData.class
        );
        Path output = Files.createDirectories(Path.of(args[1]));

        ChargeReport report = Application.generateBilling(
            data,
            today,
            new Invoice(),
            new EmailToFile(output.resolve("emails.txt"))
        );
        report.save(output.resolve("charges.txt"));
        System.out.println("charges generated in " + args[1]);
    }
}
