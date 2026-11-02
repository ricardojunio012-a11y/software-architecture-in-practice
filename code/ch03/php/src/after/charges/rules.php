<?php
// Internal billing rules, used only by the module itself.
namespace Morada\After\Charges;

require_once __DIR__ . '/../shared/dates.php';
require_once __DIR__ . '/../shared/money.php';

use function Morada\After\Shared\daysBetween;
use function Morada\After\Shared\percentOf;

const RESERVE_FUND = 10; // % of the dues
const LATE_FEE = 2; // % of the arrears

function reserveFund(int $dues): int
{
    return percentOf($dues, RESERVE_FUND);
}

function lateCharges(int $arrears, string $dueDate, \DateTimeImmutable $today): array
{
    $days = daysBetween($dueDate, $today);
    $interest = intdiv($arrears * $days + 1500, 3000); // 1% a month, prorated
    return [
        'days' => $days,
        'lateFee' => percentOf($arrears, LATE_FEE),
        'interest' => $interest,
    ];
}
