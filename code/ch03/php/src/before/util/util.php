<?php
// Assorted utilities: whatever did not fit anywhere else (coincidental cohesion).
namespace Morada\Before\Util;

require_once __DIR__ . '/../config/config.php';

use Morada\Before\Config\Config;

function dollars(int $c): string
{
    return number_format(intdiv($c, 100), 0, '.', ',') .
        '.' .
        str_pad((string) ($c % 100), 2, '0', STR_PAD_LEFT);
}

// Depends, without saying so, on the date kept in the global configuration
function daysLate(string $dueDate): int
{
    return (new \DateTimeImmutable($dueDate))->diff(Config::$today)->days;
}

function period(): string
{
    return Config::$today->format('m/Y');
}
