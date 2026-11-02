// Usage: java morada.before.Main <input.json> <output-folder> [--today YYYY-MM-DD]
// The gateway is hard-coded: the GATEWAY variable changes nothing here.
package morada.before;

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
        var data = new ObjectMapper().readTree(Path.of(args[0]).toFile());
        String[] outputs = Issuing.issueCharges(data, today);
        Path output = Path.of(args[1]);
        Files.createDirectories(output);
        Files.writeString(output.resolve("charges.txt"), outputs[0]);
        Files.writeString(output.resolve("registrations.txt"), outputs[1]);
        System.out.println("charges issued in " + output);
    }
}
