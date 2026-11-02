<?php
// Usage: php main.php <input.json> <output-folder> [--today YYYY-MM-DD]
// The only place that knows about files, the clock and concrete implementations.
require __DIR__ . '/application.php';

use Morada\Step3\Invoice;
use Morada\Step3\EmailToFile;
use function Morada\Step3\generateBilling;

[, $input, $output, $option, $dateArg] = $argv + array_fill(0, 5, null);
$today = new DateTimeImmutable(
    $option === '--today' ? $dateArg : 'today',
    new DateTimeZone('UTC'),
);
$data = json_decode(file_get_contents($input), true);

if (!is_dir($output)) {
    mkdir($output, 0777, true);
}
$report = generateBilling(
    $data,
    $today,
    new Invoice(),
    new EmailToFile("$output/emails.txt"),
);
$report->save("$output/charges.txt");
echo "charges generated in $output\n";
