<?php
// Usage: php main.php in-memory|dual-write|outbox <output-folder>
// Billing confirms three payments; Bookings and Communications react to the event.
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/events.php';
require_once __DIR__ . '/modules/bookings.php';
require_once __DIR__ . '/modules/communications.php';
require_once __DIR__ . '/infra/db.php';
require_once __DIR__ . '/infra/broker.php';

use Morada\Modules\{Communications, Bookings};
use PhpAmqpLib\Channel\AMQPChannel;

use function Morada\eventFor;
use function Morada\Infra\{connectDb, connectBroker, consumeAll};
use function Morada\Infra\{saveWithOutbox, savePayment, publish};

[, $version, $outDir] = $argv;
$scenario = json_decode(file_get_contents('/data/input/scenario.json'), true);
$bookings = new Bookings($scenario['bookings']);
$communications = new Communications();
$execution = [];

// In-memory bus: the subscribers run right away, in the same process
function runInMemory(array $payments, array $subscribers, array &$execution): void
{
    foreach ($payments as $p) {
        $e = eventFor($p);
        $execution[] = "{$p['payment']} confirmed; {$e['event']} delivered in memory";
        foreach ($subscribers as $subscriber) {
            $subscriber($e);
        }
    }
}

// The relay reads the outbox and publishes what is pending; it marks it published later
function runRelay(
    PDO $db,
    AMQPChannel $channel,
    array &$crashBefore,
    array &$execution,
): void {
    $rows = $db
        ->query('SELECT id, event, payload FROM outbox WHERE NOT published ORDER BY id')
        ->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as $r) {
        publish($channel, json_decode($r['payload'], true));
        if (isset($crashBefore[$r['event']])) {
            unset($crashBefore[$r['event']]);
            $execution[] = "relay published {$r['event']} and crashed before marking";
            return;
        }
        $db->prepare('UPDATE outbox SET published = true WHERE id = ?')->execute([
            $r['id'],
        ]);
        $execution[] = "relay published {$r['event']}";
    }
}

$onPayment = [
    fn($e) => $bookings->onPaymentConfirmed($e),
    fn($e) => $communications->onPaymentConfirmed($e),
];
if ($version === 'in-memory') {
    runInMemory($scenario['payments'], $onPayment, $execution);
} else {
    $withOutbox = $version === 'outbox';
    $db = connectDb();
    [$channel, $connection] = connectBroker();
    foreach ($scenario['payments'] as $p) {
        $e = eventFor($p);
        if ($withOutbox) {
            saveWithOutbox($db, $p, $e);
            $execution[] = "{$p['payment']} saved with {$e['event']} in the outbox";
            continue;
        }
        // Dual write: save to the database, then publish, in two separate steps
        savePayment($db, $p);
        if (($p['failure'] ?? '') === 'after-write') {
            $execution[] = "{$p['payment']} saved; the process crashed before publishing";
            continue;
        }
        publish($channel, $e);
        $execution[] = "{$p['payment']} saved; {$e['event']} published";
    }
    if ($withOutbox) {
        $crashBefore = [];
        foreach ($scenario['payments'] as $p) {
            if (($p['failure'] ?? '') === 'relay-before-mark') {
                $crashBefore["E-{$p['payment']}"] = true;
            }
        }
        runRelay($db, $channel, $crashBefore, $execution);
        runRelay($db, $channel, $crashBefore, $execution);
    }
    consumeAll($channel, 'bookings.payments', $onPayment[0]);
    consumeAll($channel, 'communications.payments', $onPayment[1]);
    $channel->close();
    $connection->close();
}

@mkdir($outDir, 0777, true);
$write = fn($name, $lines) => file_put_contents(
    "$outDir/$name",
    implode("\n", $lines) . "\n",
);
$write('execution.txt', $execution);
$write('consumption.txt', [...$bookings->log, ...$communications->log]);
$write('result.txt', [...$bookings->lines(), ...$communications->notices]);
echo "$version: output in $outDir\n";
