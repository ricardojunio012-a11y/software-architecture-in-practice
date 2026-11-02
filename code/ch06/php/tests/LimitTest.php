<?php
// The sprout class tests: the new rule is tested alone, without the legacy code.
require_once __DIR__ . '/../src/step6/limit.php';

use Morada\Step6\MonthlyLimit;
use PHPUnit\Framework\TestCase;

final class LimitTest extends TestCase
{
    private function partyRoom(string $unit, string $date): array
    {
        return ['unit' => $unit, 'space' => 'party-room', 'date' => $date];
    }

    private function grill(string $date): array
    {
        return ['unit' => 'A-101', 'space' => 'grill-area', 'date' => $date];
    }

    public function testDeclinesASecondPartyRoomBookingInTheSameMonth(): void
    {
        $made = [$this->partyRoom('A-101', '2026-03-14')];
        $request = $this->partyRoom('A-101', '2026-03-28');
        $this->assertTrue((new MonthlyLimit())->reached($request, $made));
    }

    public function testDoesNotCountAnotherMonthAnotherUnitOrAnotherSpace(): void
    {
        $made = [
            $this->partyRoom('A-101', '2026-02-28'),
            $this->partyRoom('B-101', '2026-03-14'),
            $this->grill('2026-03-07'),
        ];
        $request = $this->partyRoom('A-101', '2026-03-28');
        $this->assertFalse((new MonthlyLimit())->reached($request, $made));
    }

    public function testGrillAreaAllowsTwoAndSpaceWithNoLimitAllowsAll(): void
    {
        $limit = new MonthlyLimit();
        $two = [$this->grill('2026-03-07'), $this->grill('2026-03-14')];
        $request = $this->grill('2026-03-21');
        $this->assertFalse($limit->reached($request, [$two[0]]));
        $this->assertTrue($limit->reached($request, $two));
        $pool = [
            'unit' => 'A-101',
            'space' => 'pool',
            'date' => '2026-03-21',
        ];
        $this->assertFalse($limit->reached($pool, [$pool, $pool]));
    }
}
