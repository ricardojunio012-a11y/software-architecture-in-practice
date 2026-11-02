<?php
namespace Morada\After\Billing\Rules;

require_once __DIR__ . '/../types.php';
require_once __DIR__ . '/../../../shared/dates.php';
require_once __DIR__ . '/../../../shared/money.php';

use Morada\After\Billing\{Entry, Rule};
use function Morada\Shared\{monthDay, percentOf};
use function Morada\After\Billing\amountOf;

// Discount on the dues owed for whoever pays by the agreed day.
// A unit with a past-due balance gets no discount (the chapter 1 rule).
final class EarlyPaymentDiscount implements Rule
{
    public function __construct(
        private readonly int $percent,
        private readonly string $until,
    ) {}

    public function apply(array $unit, array $posted): array
    {
        $duesOwed = amountOf($posted, 'dues') + amountOf($posted, 'exemption');
        if ($duesOwed <= 0 || amountOf($posted, 'arrears') > 0) {
            return [];
        }
        $description = 'Discount by ' . monthDay($this->until) . " ({$this->percent}%)";
        $discount = percentOf($duesOwed, $this->percent);
        return [new Entry('discount', $description, -$discount, conditional: true)];
    }
}
