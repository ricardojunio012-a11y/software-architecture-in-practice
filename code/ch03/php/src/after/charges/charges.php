<?php
// Public interface of the charges module: the other modules use only what is here.
namespace Morada\After\Charges;

require_once __DIR__ . '/../shared/dates.php';
require_once __DIR__ . '/../shared/money.php';
require_once __DIR__ . '/rules.php';

use function Morada\After\Shared\dollars;
use function Morada\After\Shared\monthLabel;
use function Morada\After\Shared\shareOf;

final class Charge
{
    public function __construct(
        public readonly string $unit,
        public readonly string $resident,
        public readonly int $dues,
        public readonly int $reserve,
        public readonly int $arrears,
        public readonly int $daysLate,
        public readonly int $lateFee,
        public readonly int $interest,
        public readonly int $total,
    ) {}
}

/** @return Charge[] */
function calculateCharges(int $expenses, array $units, \DateTimeImmutable $today): array
{
    return array_map(function (array $u) use ($expenses, $today) {
        $dues = shareOf($expenses, $u['shareMillionths']);
        $reserve = reserveFund($dues);
        $arrears = $u['pastDue']['amountCents'] ?? 0;
        $l = $u['pastDue']
            ? lateCharges($arrears, $u['pastDue']['dueDate'], $today)
            : ['days' => 0, 'lateFee' => 0, 'interest' => 0];
        $total = $dues + $reserve + $arrears + $l['lateFee'] + $l['interest'];
        return new Charge(
            $u['id'],
            $u['resident']['name'],
            $dues,
            $reserve,
            $arrears,
            $l['days'],
            $l['lateFee'],
            $l['interest'],
            $total,
        );
    }, $units);
}

/** @param Charge[] $charges */
function chargeReport(
    string $community,
    \DateTimeImmutable $today,
    array $charges,
): string {
    $lines = ['# Charges ' . monthLabel($today) . " - $community"];
    $lines[] = 'unit;resident;dues;reserve;arrears;late_fee;interest;total';
    foreach ($charges as $c) {
        $amounts = array_map('Morada\After\Shared\dollars', [
            $c->dues,
            $c->reserve,
            $c->arrears,
            $c->lateFee,
            $c->interest,
            $c->total,
        ]);
        $lines[] = implode(';', [$c->unit, $c->resident, ...$amounts]);
    }
    return implode("\n", $lines) . "\n";
}
