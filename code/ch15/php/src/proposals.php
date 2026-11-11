<?php
// The "compatibility" version: compares each proposal in input/proposals with the
// published contract and says whether it can be published without breaking clients.
require_once __DIR__ . '/contract/compatibility.php';

use function Morada\Contract\{compareContracts, readContract};

$data = $argv[1];
$published = readContract("$data/openapi/published/v1.yaml");
$folder = "$data/input/proposals";

$report = [];
$incompatible = 0;
$proposals = array_values(array_diff(scandir($folder), ['.', '..']));
sort($proposals);
foreach ($proposals as $file) {
    $changes = compareContracts($published, readContract("$folder/$file"));
    $breaks = (bool) array_filter($changes, fn($c) => !$c->compatible);
    $incompatible += (int) $breaks;
    $report[] = "$file: " . ($breaks ? 'INCOMPATIBLE' : 'compatible');
    foreach ($changes as $c) {
        $report[] = '  ' . ($c->compatible ? '+' : '-') . " {$c->text}";
    }
}
$report[] = '';
$report[] = "incompatible proposals: $incompatible of " . count($proposals);

$output = "$data/output/compatibility";
@mkdir($output, 0777, true);
file_put_contents("$output/report.txt", implode("\n", $report) . "\n");
echo "compatibility: $incompatible of " . count($proposals) . " incompatible\n";
