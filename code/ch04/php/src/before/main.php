<?php
// Usage: php main.php <input.json> <output-folder> [--today YYYY-MM-DD]
// The gateway is hard-coded: the GATEWAY variable changes nothing here.
require_once __DIR__ . '/issuing.php';

use function Morada\Before\issueCharges;

[, $input, $output, $option, $date] = $argv + array_fill(0, 5, null);
$today = new DateTimeImmutable(
    $option === '--today' ? $date : 'today',
    new DateTimeZone('UTC'),
);
$data = json_decode(file_get_contents($input), true);
[$charges, $registrations] = issueCharges($data, $today);
@mkdir($output, 0777, true);
file_put_contents("$output/charges.txt", $charges);
file_put_contents("$output/registrations.txt", $registrations);
echo "charges issued in $output\n";
