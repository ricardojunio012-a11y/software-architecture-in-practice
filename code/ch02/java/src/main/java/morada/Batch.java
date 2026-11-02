// Usage: java morada.Batch <batch.json>
// Simulates the batch invoice queue and compares the time to confirmation with the target.
package morada;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Path;
import java.util.Locale;

public class Batch {

    static String number(long n) {
        return String.format(Locale.US, "%,d", n);
    }

    static String percent(double n) {
        return String.format(Locale.US, "%.2f%%", n);
    }

    // 10 min | 1 h 36 min | never
    static String duration(Number seconds) {
        if (seconds == null) return "never";
        long minutes = Math.round(seconds.doubleValue() / 60);
        long h = minutes / 60;
        if (h == 0) return minutes + " min";
        return minutes % 60 == 0 ? h + " h" : h + " h " + (minutes % 60) + " min";
    }

    public static void main(String[] args) throws Exception {
        var p = new ObjectMapper().readValue(
            Path.of(args[0]).toFile(),
            BatchQueue.Assumptions.class
        );
        System.out.println(
            p.id() + ": " + p.description() + " (seed " + p.seed() + ")"
        );
        System.out.println(
            "  assumptions: " +
                number(p.invoices()) +
                " invoices in files of " +
                number(p.invoicesPerFile()) +
                ", " +
                number(p.invoicesPerSecond()) +
                " per second,"
        );
        System.out.println(
            "  return file " +
                duration(p.returnSeconds()) +
                " after each file, " +
                p.transientFailurePercent() +
                "% transient rejections, 1 in " +
                p.permanentRejectionEvery() +
                " permanent"
        );
        System.out.println(
            "  estimate by division: " +
                duration((double) p.invoices() / p.invoicesPerSecond()) +
                "  target: all within " +
                duration(p.limitSeconds())
        );
        int failures = 0;
        for (boolean adjusted : new boolean[] { false, true }) {
            var r = BatchQueue.simulate(p, adjusted);
            int within = BatchQueue.availableBy(r, p.limitSeconds());
            boolean passed = within == p.invoices();
            if (!passed) failures++;
            System.out.println(adjusted ? "adjusted:" : "naive:");
            System.out.println(
                "  files: " + r.files + "  creation attempts: " + number(r.attempts)
            );
            System.out.println(
                "  available at p50: " +
                    pct(r, p, 500) +
                    "  p95: " +
                    pct(r, p, 950) +
                    "  p99: " +
                    pct(r, p, 990) +
                    "  p99.9: " +
                    pct(r, p, 999)
            );
            System.out.println(
                "  last available: " +
                    duration(r.availableAt.lastKey()) +
                    "  never created: " +
                    number(r.notCreated) +
                    "  by card: " +
                    number(r.viaCard)
            );
            System.out.println(
                "  within " +
                    duration(p.limitSeconds()) +
                    ": " +
                    number(within) +
                    " (" +
                    percent((100.0 * within) / p.invoices()) +
                    ")"
            );
            System.out.println("  result: " + (passed ? "PASSED" : "FAILED"));
        }
        System.exit(failures > 0 ? 1 : 0);
    }

    private static String pct(
        BatchQueue.Result r,
        BatchQueue.Assumptions p,
        int thousandths
    ) {
        return duration(BatchQueue.percentile(r, p.invoices(), thousandths));
    }
}
