<?php
// Usage: php main.php <charges.json> <plugins-folder> <output-folder>
require_once __DIR__ . '/core.php';

use Morada\Plugins\{Charge, Core};

[, $input, $pluginsFolder, $output] = $argv;
$core = new Core();
$core->load($pluginsFolder);

$data = json_decode(file_get_contents($input), true);
$lines = ['plugins loaded: ' . implode(', ', $core->names())];
foreach ($data['charges'] as $c) {
    $lines[] = $core->issue(new Charge($c['unit'], $c['amountCents'], $c['bank']));
}

@mkdir($output, 0777, true);
file_put_contents("$output/batch.txt", implode("\n", $lines) . "\n");
echo count($data['charges']) . " charges; output in $output\n";
