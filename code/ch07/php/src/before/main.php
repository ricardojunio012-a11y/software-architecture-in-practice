<?php
// Usage: php main.php <commands.json> <output-folder>
require_once __DIR__ . '/service.php';

use Morada\Before\Bookings;
use function Morada\Before\{book, cancel, hours};

[, $input, $output] = $argv;
$data = json_decode(file_get_contents($input), true);
$spaces = array_column($data['spaces'], null, 'id');
$events = [];
$results = [];
foreach ($data['commands'] as $c) {
    $r =
        $c['type'] === 'book'
            ? book($c, $spaces[$c['space']], $events)
            : cancel($c, $events);
    $results[] = "{$c['booking']};{$c['type']};$r";
}
$schedule = [];
foreach ($data['spaces'] as $s) {
    foreach (Bookings::$all as $b) {
        if ($b->space === $s['id'] && $b->status === 'confirmed') {
            $slot = "{$b->date} " . hours($b->start, $b->end);
            $schedule[] = "{$b->space};{$b->id};$slot;{$b->unit}";
        }
    }
}

@mkdir($output, 0777, true);
foreach (
    ['results' => $results, 'events' => $events, 'schedule' => $schedule]
    as $n => $l
) {
    file_put_contents("$output/$n.txt", implode("\n", $l) . "\n");
}
echo count($results) . " commands executed; output in $output\n";
