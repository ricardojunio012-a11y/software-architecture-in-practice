<?php
// Usage: php main.php online|offline|restart|persisted <output-folder>
// Simulates a morning at the front desk with two tablets. In the offline version,
// tablet A loses the internet, works from the local queue, and syncs when it comes back.
require_once __DIR__ . '/tablet.php';

use Morada\{StaffBff, FrontDesk, Bookings, Tablet};

[, $version, $output] = $argv;
$scenario = json_decode(file_get_contents('/data/input/scenario.json'), true);
$frontDesk = new FrontDesk($scenario['packages']);
$bookings = new Bookings($scenario['guests']);
// In the persisted version, the result of each operation goes to a table that
// outlives the BFF process; in the others, it lives only in the BFF's memory
$operationsTable = new ArrayObject();
$newBff = fn() => new StaffBff(
    $frontDesk,
    $bookings,
    $version === 'persisted' ? $operationsTable : new ArrayObject(),
);
$bff = $newBff();
$log = [];
$connect = function () use (&$bff) {
    return $bff;
};
$tablets = [
    'A' => new Tablet('A', $connect, $log),
    'B' => new Tablet('B', $connect, $log),
];

foreach ($scenario['steps'] as $step) {
    if (isset($step['only']) && !in_array($version, $step['only'], true)) {
        continue;
    }
    if ($step['action'] === 'restartBff') {
        $bff = $newBff();
        $log[] = 'the BFF restarted: what was only in its memory is gone';
        continue;
    }
    $tablet = $tablets[$step['tablet']];
    match ($step['action']) {
        'open' => $tablet->open(),
        'disconnect' => $tablet->disconnect(),
        'reconnect' => $tablet->reconnect($step['loseResponse']),
        'resend' => $tablet->resend(),
        default => $tablet->operate(
            ['type' => $step['action']] +
                array_diff_key($step, ['tablet' => 0, 'action' => 0]),
        ),
    };
}

$state = [];
foreach ($frontDesk->packages as $p) {
    $state[] = isset($p['by'])
        ? "{$p['id']} {$p['unit']}: {$p['status']} " .
            "by tablet {$p['by']} at {$p['time']}"
        : "{$p['id']} {$p['unit']}: {$p['status']}";
}
foreach ($frontDesk->visitors as $v) {
    $state[] = "{$v['name']} ({$v['booking']}) entered at {$v['time']} on tablet {$v['tablet']}";
}
$state[] = "repeated operations ignored: {$bff->repeated}";

@mkdir("$output/$version", 0777, true);
file_put_contents("$output/$version/log.txt", implode("\n", $log) . "\n");
file_put_contents("$output/$version/state.txt", implode("\n", $state) . "\n");
echo "$version: output in $output/$version\n";
