// Tests of the batch queue simulation: same seed, same result.
package morada;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import org.junit.jupiter.api.Test;

class BatchQueueTest {

    private static final BatchQueue.Assumptions ASSUMPTIONS =
        new BatchQueue.Assumptions("T", "test", 1000, 250, 10, 100, 20, 50, 3, 400, 7);

    @Test
    void naiveTailGoesPastTheLimitAndSomeAreNeverCreated() {
        var r = BatchQueue.simulate(ASSUMPTIONS, false);
        assertEquals(
            List.of(12L, 1246L, 26L),
            List.of((long) r.files, r.attempts, (long) r.notCreated)
        );
        assertEquals(968, BatchQueue.availableBy(r, 400));
        assertEquals(175L, BatchQueue.percentile(r, 1000, 500));
        assertNull(BatchQueue.percentile(r, 1000, 990)); // p99 falls on the never created
    }

    @Test
    void adjustedAllAvailableWithinTheLimitPartByCard() {
        var r = BatchQueue.simulate(ASSUMPTIONS, true);
        assertEquals(
            List.of(11L, 1199L, 32L),
            List.of((long) r.files, r.attempts, (long) r.viaCard)
        );
        assertEquals(1000, BatchQueue.availableBy(r, 400));
        assertEquals(357L, BatchQueue.percentile(r, 1000, 990));
    }

    @Test
    void sameSeedSameResult() {
        var a = BatchQueue.simulate(ASSUMPTIONS, false);
        var b = BatchQueue.simulate(ASSUMPTIONS, false);
        assertEquals(a.availableAt, b.availableAt);
        assertEquals(a.attempts, b.attempts);
    }
}
