<?php
namespace Morada\After\Billing\Rules;

require_once __DIR__ . '/../types.php';
require_once __DIR__ . '/../../../shared/dates.php';

use Morada\After\Billing\{Entry, Rule};
use function Morada\Shared\daysBetween;

// Monthly interest, prorated by the days late (30-day month).
final class LateInterest implements Rule
{
    public function __construct(
        private readonly int $monthlyPercent,
        private readonly \DateTimeImmutable $today,
    ) {}

    public function apply(array $unit, array $posted): array
    {
        $d = $unit['pastDue'];
        if (!$d) {
            return [];
        }
        $days = daysBetween($d['dueDate'], $this->today);
        $interest = intdiv(
            $d['amountCents'] * $this->monthlyPercent * $days + 1500,
            3000,
        );
        return [new Entry('interest', "Interest ($days days)", $interest)];
    }
}
