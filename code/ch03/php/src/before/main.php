<?php
// Usage: php main.php <input.json> <output-folder> [--today YYYY-MM-DD]
require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/services/services.php';

use Morada\Before\Config\Config;
use Morada\Before\Services\Services;

[, $input, $output, $option, $date] = $argv + array_fill(0, 5, null);
Config::$today = new DateTimeImmutable(
    $option === '--today' ? $date : 'today',
    new DateTimeZone('UTC'),
);
Config::$data = json_decode(file_get_contents($input), true);
Services::calculateAll();

// The order matters: the delinquency report reorders the list of charges
if (!is_dir($output)) {
    mkdir($output, 0777, true);
}
foreach (['charges', 'delinquency', 'financial-report'] as $type) {
    file_put_contents("$output/$type.txt", Services::generateOutput($type));
}
echo "reports generated in $output\n";
