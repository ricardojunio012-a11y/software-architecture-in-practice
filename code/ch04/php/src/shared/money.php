<?php
// Amounts in cents and half-up rounding.
namespace Morada\Shared;

function shareOf(int $cents, int $millionths): int
{
    return intdiv($cents * $millionths + 500000, 1000000);
}

function percentOf(int $cents, int $percent): int
{
    return intdiv($cents * $percent + 50, 100);
}

// 1,352.18 (US format, with a sign when negative)
function dollars(int $c): string
{
    $a = abs($c);
    $whole = number_format(intdiv($a, 100), 0, '.', ',');
    return ($c < 0 ? '-' : '') . $whole . '.' . sprintf('%02d', $a % 100);
}

// 1352.18 (the format the Alpha Bank API asks for)
function plainDollars(int $c): string
{
    return intdiv($c, 100) . '.' . sprintf('%02d', $c % 100);
}
