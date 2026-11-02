// Usage: java morada.step5.Main <input.json> <output-folder> [--today YYYY-MM-DD]
// Main does all the input and output; the bookings module does not touch files.
package morada.step5;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;

public class Main {

    public static void main(String[] args) throws Exception {
        LocalDate today =
            args.length > 3 && args[2].equals("--today")
                ? LocalDate.parse(args[3])
                : LocalDate.now();
        var data = new ObjectMapper().readValue(
            Path.of(args[0]).toFile(),
            Bookings.Data.class
        );
        var decisions = Bookings.decide(data, today);

        // The real email client would go here; in the lab, a file
        List<String> emails = Bookings.notices(decisions)
            .stream()
            .map(n -> "to " + n.to() + ": " + n.text())
            .toList();
        Path output = Path.of(args[1]);
        Files.createDirectories(output);
        String report = String.join("\n", Bookings.report(decisions)) + "\n";
        Files.writeString(output.resolve("bookings.txt"), report);
        Files.writeString(
            output.resolve("emails.txt"),
            String.join("\n", emails) + "\n"
        );
    }
}
