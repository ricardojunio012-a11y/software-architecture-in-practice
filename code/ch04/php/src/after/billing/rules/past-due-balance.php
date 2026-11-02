<?php
namespace Morada\After\Billing\Rules;

require_once __DIR__ . '/../types.php';
require_once __DIR__ . '/../../../shared/dates.php';

use Morada\After\Billing\{Entry, Rule};
use function Morada\Shared\monthDay;

// The amount left unpaid from the previous month.
final class PastDueBalance implements Rule
{
    public function apply(array $unit, array $posted): array
    {
        $d = $unit['pastDue'];
        if (!$d) {
            return [];
        }
        $description = 'Past-due balance (due ' . monthDay($d['dueDate']) . ')';
        return [new Entry('arrears', $description, $d['amountCents'])];
    }
}
