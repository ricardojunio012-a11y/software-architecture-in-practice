// Simulation of the batch invoice queue at the payment processor ("now the hard part").
// Simulated clock and a fixed-seed random draw: the same output on any machine.
// The numbers in batch.json are lab assumptions, not those of a real processor.
package morada;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

public final class BatchQueue {

    public record Assumptions(
        String id,
        String description,
        int invoices,
        int invoicesPerFile,
        int invoicesPerSecond, // processor throughput while it processes a batch file
        long returnSeconds, // the return file for each batch arrives this much later
        int transientFailurePercent, // a rejection that may succeed on a new attempt
        int permanentRejectionEvery, // 1 in N invoices has bad data (e.g., tax ID)
        int maxAttempts,
        long limitSeconds,
        long seed
    ) {}

    public static final class Result {

        public int files;
        public long attempts;
        // simulation second -> how many invoices (sorted by time)
        public final TreeMap<Long, Integer> availableAt = new TreeMap<>();
        public int notCreated; // never became available
        public int viaCard; // got card payment instead of the invoice

        void available(long t) {
            availableAt.merge(t, 1, Integer::sum);
        }
    }

    private record BatchFile(
        long sentAt,
        int order,
        List<Integer> invoices,
        int attempt
    ) {}

    private BatchQueue() {}

    // naive: resends every rejection and notifies the resident only with a created
    // invoice. adjusted: a permanent rejection does not go back to the queue, and an
    // invoice with no time left to be confirmed switches to card payment (ADR-002).
    public static Result simulate(Assumptions p, boolean adjusted) {
        // Park-Miller congruential generator: integers only, the same in all languages
        long[] x = { p.seed() };
        List<BatchFile> queue = new ArrayList<>();
        for (int i = 0; i < p.invoices(); i += p.invoicesPerFile()) {
            int end = Math.min(p.invoices(), i + p.invoicesPerFile());
            List<Integer> invoices = new ArrayList<>();
            for (int inv = i; inv < end; inv++) invoices.add(inv);
            queue.add(new BatchFile(0, queue.size(), invoices, 1));
        }
        Result r = new Result();
        int order = queue.size();
        long processorFree = 0;
        while (!queue.isEmpty()) {
            // The processor handles one file at a time, in order of arrival
            int i = 0;
            for (int k = 1; k < queue.size(); k++) {
                BatchFile a = queue.get(k),
                    b = queue.get(i);
                if (
                    a.sentAt() < b.sentAt() ||
                    (a.sentAt() == b.sentAt() && a.order() < b.order())
                ) {
                    i = k;
                }
            }
            BatchFile batch = queue.remove(i);
            int n = batch.invoices().size();
            r.files++;
            r.attempts += n;
            long start = Math.max(batch.sentAt(), processorFree);
            long perSecond = p.invoicesPerSecond();
            processorFree = start + (n + perSecond - 1) / perSecond;
            long returnAt = processorFree + p.returnSeconds();
            List<Integer> resend = new ArrayList<>();
            for (int inv : batch.invoices()) {
                boolean permanent = inv % p.permanentRejectionEvery() == 0;
                boolean rejected = permanent;
                if (!permanent) {
                    x[0] = (x[0] * 48271) % 2147483647;
                    rejected = x[0] % 100 < p.transientFailurePercent();
                }
                if (!rejected) {
                    r.available(returnAt);
                } else if (!adjusted) {
                    if (batch.attempt() < p.maxAttempts()) resend.add(inv);
                    else r.notCreated++;
                } else if (
                    permanent ||
                    batch.attempt() >= p.maxAttempts() ||
                    returnAt + p.returnSeconds() > p.limitSeconds()
                ) {
                    r.available(returnAt); // the notice goes out with card payment
                    r.viaCard++;
                } else {
                    resend.add(inv);
                }
            }
            if (!resend.isEmpty()) {
                queue.add(
                    new BatchFile(returnAt, order++, resend, batch.attempt() + 1)
                );
            }
        }
        return r;
    }

    // Nearest-rank percentile, in thousandths (990 = p99, 999 = p99.9).
    // Returns null when it falls on the invoices that never became available.
    public static Long percentile(Result r, int total, int thousandths) {
        long rank = ((long) thousandths * total + 999) / 1000;
        long cumulative = 0;
        for (Map.Entry<Long, Integer> e : r.availableAt.entrySet()) {
            cumulative += e.getValue();
            if (cumulative >= rank) return e.getKey();
        }
        return null;
    }

    public static int availableBy(Result r, long limit) {
        return r.availableAt
            .headMap(limit, true)
            .values()
            .stream()
            .mapToInt(Integer::intValue)
            .sum();
    }
}
