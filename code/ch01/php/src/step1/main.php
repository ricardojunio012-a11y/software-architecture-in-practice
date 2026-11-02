<?php
// Usage: php main.php <input.json> <output-folder> [--today YYYY-MM-DD]
require __DIR__ . '/billing.php';

[, $input, $output, $option, $dateArg] = $argv + array_fill(0, 5, null);
$today =
    $option === '--today'
        ? new DateTimeImmutable($dateArg, new DateTimeZone('UTC'))
        : null;
Morada\Step1\generateBilling($input, $output, $today);
echo "charges generated in $output\n";
