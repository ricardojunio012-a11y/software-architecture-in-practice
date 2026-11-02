<?php
// Tests of the batch queue simulation: same seed, same result.
require_once __DIR__ . '/../src/batch_queue.php';

use PHPUnit\Framework\TestCase;
use function Morada\Batch\availableBy;
use function Morada\Batch\percentile;
use function Morada\Batch\simulate;

final class BatchQueueTest extends TestCase
{
    private const ASSUMPTIONS = [
        'id' => 'T',
        'description' => 'test',
        'invoices' => 1000,
        'invoicesPerFile' => 250,
        'invoicesPerSecond' => 10,
        'returnSeconds' => 100,
        'transientFailurePercent' => 20,
        'permanentRejectionEvery' => 50,
        'maxAttempts' => 3,
        'limitSeconds' => 400,
        'seed' => 7,
    ];

    public function testNaiveTailGoesPastTheLimitAndSomeAreNeverCreated(): void
    {
        $r = simulate(self::ASSUMPTIONS, false);
        $this->assertSame([12, 1246, 26], [$r->files, $r->attempts, $r->notCreated]);
        $this->assertSame(968, availableBy($r, 400));
        $this->assertSame(175, percentile($r, 1000, 500));
        $this->assertNull(percentile($r, 1000, 990)); // p99 falls on the never created
    }

    public function testAdjustedAllAvailableWithinTheLimitPartByCard(): void
    {
        $r = simulate(self::ASSUMPTIONS, true);
        $this->assertSame([11, 1199, 32], [$r->files, $r->attempts, $r->viaCard]);
        $this->assertSame(1000, availableBy($r, 400));
        $this->assertSame(357, percentile($r, 1000, 990));
    }

    public function testSameSeedSameResult(): void
    {
        $this->assertEquals(
            simulate(self::ASSUMPTIONS, false),
            simulate(self::ASSUMPTIONS, false),
        );
    }
}
