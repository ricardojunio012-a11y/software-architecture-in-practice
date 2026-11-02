<?php
namespace Morada\After\Billing\Rules;

require_once __DIR__ . '/../types.php';
require_once __DIR__ . '/../../../shared/money.php';

use Morada\After\Billing\{Entry, Rule};
use function Morada\Shared\shareOf;

// The unit's part of the month's expenses, by its ownership share.
final class MonthlyDues implements Rule
{
    public function __construct(private readonly int $monthlyExpenses) {}

    public function apply(array $unit, array $posted): array
    {
        $dues = shareOf($this->monthlyExpenses, $unit['shareMillionths']);
        return [new Entry('dues', 'Monthly dues', $dues)];
    }
}
