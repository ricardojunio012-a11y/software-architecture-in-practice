<?php
// The token bucket: it lets the burst through, rejects the excess, and refills over time.
require_once __DIR__ . '/../src/bucket.php';

use Morada\TokenBucket;
use PHPUnit\Framework\TestCase;

final class BucketTest extends TestCase
{
    public function testAllowsTheBurstRejectsTheExcessAndGainsTokensOverTime(): void
    {
        $bucket = new TokenBucket(10, 20);
        for ($i = 0; $i < 10; $i++) {
            $this->assertTrue($bucket->allows(0));
        }
        $this->assertFalse($bucket->allows(0));
        // 20 tokens per second: one token every 50 ms
        $this->assertFalse($bucket->allows(49));
        $this->assertTrue($bucket->allows(99));
    }
}
