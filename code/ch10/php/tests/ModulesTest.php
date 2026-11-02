<?php
// Tests: each module tested through its own API, and Bookings tested without Billing.
require_once __DIR__ . '/../src/after/modules/billing/api.php';
require_once __DIR__ . '/../src/after/modules/bookings/api.php';

use Morada\After\Modules\Billing\Billing;
use Morada\After\Modules\Billing\Internal\ChargesTable;
use Morada\After\Modules\Bookings\{RejectionError, Bookings, FinancialStanding};
use PHPUnit\Framework\TestCase;

final class ModulesTest extends TestCase
{
    private static function standing(bool $inGoodStanding): FinancialStanding
    {
        return new class ($inGoodStanding) implements FinancialStanding {
            public function __construct(private bool $inGoodStanding) {}

            public function unitInGoodStanding(string $unit, string $today): bool
            {
                return $this->inGoodStanding;
            }
        };
    }

    public function testInstallmentPlanKeepsTheUnitInGoodStanding(): void
    {
        $billing = new Billing(new ChargesTable());
        $billing->issue('C-1', 'B-101', 58685, '2026-02-10');
        $this->assertFalse($billing->unitInGoodStanding('B-101', '2026-03-02'));
        $billing->split('C-1', 3);
        $this->assertTrue($billing->unitInGoodStanding('B-101', '2026-03-02'));
    }

    public function testRejectsUnitInArrearsWithAFakeBilling(): void
    {
        $bookings = new Bookings(['party-room'], self::standing(false));
        $this->expectException(RejectionError::class);
        $bookings->book('R-1', 'A-1', 'party-room', '2026-03-14', '2026-03-02');
    }

    public function testDoesNotAcceptTwoBookingsOfTheSameSpaceOnTheSameDay(): void
    {
        $bookings = new Bookings(['party-room'], self::standing(true));
        $bookings->book('R-1', 'A-1', 'party-room', '2026-03-14', '2026-03-02');
        $this->expectExceptionMessage('party-room already booked on 2026-03-14');
        $bookings->book('R-2', 'A-2', 'party-room', '2026-03-14', '2026-03-02');
    }
}
