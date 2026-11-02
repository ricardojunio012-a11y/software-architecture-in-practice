// Usage: java morada.Main <scenarios.json>
// Runs each scenario, prints the report and exits with an error if any of them fails.
package morada;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

public class Main {

    static String number(double n) {
        return String.format(Locale.US, "%,d", Math.round(n));
    }

    static String decimal(double n, int places) {
        return String.format(Locale.US, "%." + places + "f", n);
    }

    // 2.25 s | 4 min | 6 h 40 min
    static String duration(double seconds) {
        if (seconds < 60) return decimal(seconds, 2) + " s";
        long minutes = Math.round(seconds / 60);
        long h = minutes / 60;
        if (h == 0) return minutes + " min";
        return minutes % 60 == 0 ? h + " h" : h + " h " + (minutes % 60) + " min";
    }

    public static void main(String[] args) throws Exception {
        List<Scenarios.Scenario> scenarios = new ObjectMapper().readValue(
            Path.of(args[0]).toFile(),
            new TypeReference<List<Scenarios.Scenario>>() {}
        );
        LocalDate today = LocalDate.of(2026, 3, 2);
        int failures = 0;

        for (var s : scenarios) {
            var r = Scenarios.run(s, today);
            if (!r.passed()) failures++;
            double throughput = r.charges() / r.calculationSeconds();
            System.out.println(s.id() + ": " + s.description());
            System.out.println(
                "  charges: " +
                    number(r.charges()) +
                    "  target: within " +
                    duration(s.limitSeconds())
            );
            System.out.println(
                "  calculation (measured): " +
                    duration(r.calculationSeconds()) +
                    ", " +
                    number(throughput) +
                    " per second"
            );
            System.out.println(
                "  invoices at the processor (estimated, " +
                    s.invoicesPerSecond() +
                    "/s): " +
                    duration(r.processorSeconds())
            );
            System.out.println(
                "  notices: " +
                    decimal(r.noticeBytes() / 1e6, 1) +
                    " MB, " +
                    number((double) r.noticeBytes() / r.charges()) +
                    " bytes per notice"
            );
            System.out.println("  result: " + (r.passed() ? "PASSED" : "FAILED"));
        }
        System.out.println(
            scenarios.size() -
                failures +
                " of " +
                scenarios.size() +
                " scenarios within target."
        );
        System.exit(failures > 0 ? 1 : 0);
    }
}
