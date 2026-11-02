<?php
// Public API of Bookings. The module declares what it needs to know from Billing
// (FinancialStanding) without depending on how Billing stores its data.
namespace Morada\Before\Modules\Bookings;

require_once __DIR__ . '/internal/schedule.php';

use Morada\Before\Modules\Bookings\Internal\Schedule;

interface FinancialStanding
{
    public function unitInGoodStanding(string $unit, string $today): bool;
}

class RejectionError extends \RuntimeException {}

final class Bookings
{
    private Schedule $schedule;

    public function __construct(
        array $spaces,
        private readonly FinancialStanding $billing,
    ) {
        $this->schedule = new Schedule($spaces);
    }

    public function book(
        string $booking,
        string $unit,
        string $space,
        string $date,
        string $today,
    ): string {
        if (!$this->billing->unitInGoodStanding($unit, $today)) {
            throw new RejectionError("unit $unit in arrears");
        }
        if ($this->schedule->occupant($space, $date) !== null) {
            throw new RejectionError("$space already booked on $date");
        }
        $this->schedule->record($booking, $space, $date);
        return "$unit $space $date";
    }
}
