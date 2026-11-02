<?php
// Before: the shortcut. Bookings reads the Billing table directly and reimplements
// the delinquency rule on its own, unaware that an installment agreement keeps the
// unit in good standing.
namespace Morada\Before\Modules\Bookings\Internal;

require_once __DIR__ . '/../api.php';
require_once __DIR__ . '/../../billing/internal/charges-table.php';

use Morada\Before\Modules\Billing\Internal\ChargesTable;
use Morada\Before\Modules\Bookings\FinancialStanding;

final class StandingFromTable implements FinancialStanding
{
    public function __construct(private readonly ChargesTable $table) {}

    public function unitInGoodStanding(string $unit, string $today): bool
    {
        foreach ($this->table->rows as $r) {
            if ($r->unit === $unit && $r->status !== 'paid' && $r->dueDate < $today) {
                return false;
            }
        }
        return true;
    }
}
