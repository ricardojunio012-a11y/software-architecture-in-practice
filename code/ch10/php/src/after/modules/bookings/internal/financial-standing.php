<?php
// After: Bookings asks Billing through the public API. The delinquency rule stays
// in one place, the module that owns it.
namespace Morada\After\Modules\Bookings\Internal;

require_once __DIR__ . '/../api.php';
require_once __DIR__ . '/../../billing/api.php';

use Morada\After\Modules\Billing\Billing;
use Morada\After\Modules\Bookings\FinancialStanding;

final class StandingFromBilling implements FinancialStanding
{
    public function __construct(private readonly Billing $billing) {}

    public function unitInGoodStanding(string $unit, string $today): bool
    {
        return $this->billing->unitInGoodStanding($unit, $today);
    }
}
