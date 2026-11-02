<?php
// Amounts in cents, rounded half up. Depends on no other module.
namespace Morada\After\Shared;

function shareOf(int $cents, int $millionths): int
{
    return intdiv($cents * $millionths + 500000, 1000000);
}

function percentOf(int $cents, int $percent): int
{
    return intdiv($cents * $percent + 50, 100);
}

function dollars(int $c): string
{
    return number_format(intdiv($c, 100), 0, '.', ',') .
        '.' .
        str_pad((string) ($c % 100), 2, '0', STR_PAD_LEFT);
}
