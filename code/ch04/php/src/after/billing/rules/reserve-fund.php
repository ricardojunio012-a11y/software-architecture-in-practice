<?php
namespace Morada\After\Billing\Rules;

require_once __DIR__ . '/../types.php';
require_once __DIR__ . '/../../../shared/money.php';

use Morada\After\Billing\{Entry, Rule};
use function Morada\Shared\percentOf;
use function Morada\After\Billing\amountOf;

// A percentage of the monthly dues, for the reserve fund.
final class ReserveFund implements Rule
{
    public function __construct(private readonly int $percent) {}

    public function apply(array $unit, array $posted): array
    {
        $reserve = percentOf(amountOf($posted, 'dues'), $this->percent);
        return [new Entry('reserve', "Reserve fund ({$this->percent}%)", $reserve)];
    }
}
