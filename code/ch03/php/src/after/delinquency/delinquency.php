<?php
// Delinquency report: reads the charges, never changes them.
namespace Morada\After\Delinquency;

require_once __DIR__ . '/../charges/charges.php';
require_once __DIR__ . '/../shared/dates.php';
require_once __DIR__ . '/../shared/money.php';

use Morada\After\Charges\Charge;
use function Morada\After\Shared\dollars;
use function Morada\After\Shared\monthLabel;

/** @param Charge[] $charges */
function delinquencyReport(
    string $community,
    \DateTimeImmutable $today,
    array $charges,
): string {
    // PHP arrays are copied when passed: sorting here does not affect the caller
    $inArrears = array_values(array_filter($charges, fn(Charge $c) => $c->arrears > 0));
    usort($inArrears, fn($a, $b) => $b->arrears <=> $a->arrears);
    $lines = ['# Delinquency ' . monthLabel($today) . " - $community"];
    $lines[] = 'unit;resident;days;arrears;late_fee;interest;amount_due';
    $sum = [0, 0, 0, 0];
    foreach ($inArrears as $c) {
        $values = [
            $c->arrears,
            $c->lateFee,
            $c->interest,
            $c->arrears + $c->lateFee + $c->interest,
        ];
        foreach ($values as $i => $v) {
            $sum[$i] += $v;
        }
        $lines[] = implode(';', [
            $c->unit,
            $c->resident,
            $c->daysLate,
            ...array_map('Morada\After\Shared\dollars', $values),
        ]);
    }
    $lines[] = implode(';', [
        'total',
        '',
        '',
        ...array_map('Morada\After\Shared\dollars', $sum),
    ]);
    return implode("\n", $lines) . "\n";
}
