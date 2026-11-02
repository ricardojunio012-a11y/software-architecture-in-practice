<?php
// Tests of the scenario runner: they check the load and the evaluation, not the time.
require_once __DIR__ . '/../src/scenarios.php';

use PHPUnit\Framework\TestCase;
use function Morada\evaluate;
use function Morada\run;
use function Morada\syntheticCommunity;

final class ScenariosTest extends TestCase
{
    public function testCreatesTheUnitsWithSharesThatAddUpToTheCommunity(): void
    {
        $units = syntheticCommunity(1, 40)['units'];
        $this->assertCount(40, $units);
        $this->assertSame(1000000, array_sum(array_column($units, 'shareMillionths')));
        $this->assertCount(5, array_filter($units, fn($u) => $u['pastDue'] !== null));
    }

    public function testPassesWithinTheLimitAndFailsAboveIt(): void
    {
        $this->assertTrue(evaluate(59.9, 60));
        $this->assertFalse(evaluate(60.1, 60));
    }

    public function testEstimatesInvoiceCreationFromTheProcessorCapacity(): void
    {
        $scenario = [
            'id' => 'T',
            'description' => 'test',
            'communities' => 3,
            'unitsPerCommunity' => 10,
            'invoicesPerSecond' => 10,
            'limitSeconds' => 2,
        ];
        $r = run(
            $scenario,
            new DateTimeImmutable('2026-03-02', new DateTimeZone('UTC')),
        );
        $this->assertSame(30, $r->charges);
        $this->assertEquals(3, $r->processorSeconds);
        $this->assertFalse($r->passed); // 3 s at the processor do not fit in 2 s
    }
}
