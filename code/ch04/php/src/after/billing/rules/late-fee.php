<?php
namespace Morada\After\Billing\Rules;

require_once __DIR__ . '/../types.php';
require_once __DIR__ . '/../../../shared/money.php';

use Morada\After\Billing\{Entry, Rule};
use function Morada\Shared\percentOf;

// A one-time late fee on the past-due balance.
final class LateFee implements Rule
{
    public function __construct(private readonly int $percent) {}

    public function apply(array $unit, array $posted): array
    {
        $d = $unit['pastDue'];
        if (!$d) {
            return [];
        }
        $fee = percentOf($d['amountCents'], $this->percent);
        return [new Entry('late-fee', "Late fee ({$this->percent}%)", $fee)];
    }
}
