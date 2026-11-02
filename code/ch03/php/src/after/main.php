<?php
// Usage: php main.php <input.json> <output-folder> [--today YYYY-MM-DD]
// Wires the modules together; the order of the reports no longer matters.
require_once __DIR__ . '/charges/charges.php';
require_once __DIR__ . '/delinquency/delinquency.php';
require_once __DIR__ . '/financialreport/financialreport.php';

use function Morada\After\Charges\calculateCharges;
use function Morada\After\Charges\chargeReport;
use function Morada\After\Delinquency\delinquencyReport;
use function Morada\After\FinancialReport\financialReport;

[, $input, $output, $option, $date] = $argv + array_fill(0, 5, null);
$today = new DateTimeImmutable(
    $option === '--today' ? $date : 'today',
    new DateTimeZone('UTC'),
);
$data = json_decode(file_get_contents($input), true);
$name = $data['community']['name'];
$charges = calculateCharges(
    $data['community']['monthlyExpensesCents'],
    $data['units'],
    $today,
);

$reports = [
    'delinquency' => delinquencyReport($name, $today, $charges),
    'charges' => chargeReport($name, $today, $charges),
    'financial-report' => financialReport(
        $name,
        $today,
        $charges,
        $data['expenses'],
        $data['reserveFundOpeningBalanceCents'],
    ),
];
if (!is_dir($output)) {
    mkdir($output, 0777, true);
}
foreach ($reports as $type => $text) {
    file_put_contents("$output/$type.txt", $text);
}
echo "reports generated in $output\n";
