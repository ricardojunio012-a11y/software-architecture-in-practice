// The token bucket: it lets the burst through, rejects the excess, and refills over time.
package morada;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class BucketTest {

    @Test
    void allowsTheBurstRejectsTheExcessAndGainsTokensOverTime() {
        var bucket = new TokenBucket(10, 20);
        for (int i = 0; i < 10; i++) assertTrue(bucket.allows(0));
        assertFalse(bucket.allows(0));
        // 20 tokens per second: one token every 50 ms
        assertFalse(bucket.allows(49));
        assertTrue(bucket.allows(99));
    }
}
