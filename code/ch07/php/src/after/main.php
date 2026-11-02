<?php
// Usage: php main.php <commands.json> <output-folder>
// Assembles the repository and the application service and runs the commands in order.
require_once __DIR__ . '/application/booking-service.php';

use Morada\After\Application\{BookingService, InMemorySchedules};
use Morada\After\Domain\{BookingConfirmed, Money, UsagePolicy};

[, $input, $output] = $argv;
$data = json_decode(file_get_contents($input), true);
$policies = [];
foreach ($data['spaces'] as $s) {
    $policies[$s['id']] = new UsagePolicy(
        Money::fromCents($s['feeCents']),
        $s['minNoticeDays'],
        $s['monthlyLimit'],
    );
}

$events = [];
$publish = function ($e) use (&$events) {
    $type = (new ReflectionClass($e))->getShortName();
    if ($e instanceof BookingConfirmed) {
        $events[] = "$type;{$e->booking};{$e->space};{$e->slot};{$e->unit};{$e->fee}";
    } else {
        $fee = $e->cancellationFee;
        $detail = $fee->cents > 0 ? "cancellation fee $fee" : 'no cancellation fee';
        $events[] = "$type;{$e->booking};$detail";
    }
};
$schedules = new InMemorySchedules($policies);
$service = new BookingService($schedules, $publish);

$results = [];
foreach ($data['commands'] as $c) {
    $r = $service->execute($c);
    $results[] = "{$r->booking};{$r->command};{$r->status};{$r->detail}";
}
$schedule = [];
foreach ($schedules->all() as $s) {
    foreach ($s->active() as $b) {
        $schedule[] = "{$s->space};{$b->id};{$b->slot};{$b->unit}";
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
