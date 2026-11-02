<?php
// Usage: php main.php <commands.json> <output-folder>
// Wires the modules and runs the Billing and Bookings commands in order.
require_once __DIR__ . '/modules/billing/api.php';
require_once __DIR__ . '/modules/bookings/api.php';
require_once __DIR__ . '/modules/bookings/internal/financial-standing.php';

use Morada\After\Modules\Billing\Billing;
use Morada\After\Modules\Billing\Internal\ChargesTable;
use Morada\After\Modules\Bookings\{RejectionError, Bookings};
use Morada\After\Modules\Bookings\Internal\StandingFromBilling;

[, $input, $output] = $argv;
$data = json_decode(file_get_contents($input), true);
$billing = new Billing(new ChargesTable());
$bookings = new Bookings($data['spaces'], new StandingFromBilling($billing));

function execute(array $c, Billing $billing, Bookings $bookings): array
{
    return match ($c['type']) {
        'issue' => [
            $c['charge'],
            'issued',
            $billing->issue($c['charge'], $c['unit'], $c['amountCents'], $c['dueDate']),
        ],
        'pay' => [$c['charge'], 'paid', $billing->pay($c['charge'], $c['on'])],
        'split' => [
            $c['charge'],
            'split',
            $billing->split($c['charge'], $c['installments']),
        ],
        default => book($c, $bookings),
    };
}

function book(array $c, Bookings $bookings): array
{
    try {
        $detail = $bookings->book(
            $c['booking'],
            $c['unit'],
            $c['space'],
            $c['date'],
            $c['on'],
        );
        return [$c['booking'], 'confirmed', $detail];
    } catch (RejectionError $error) {
        return [$c['booking'], 'rejected', $error->getMessage()];
    }
}

$lines = [];
foreach ($data['commands'] as $c) {
    [$id, $status, $detail] = execute($c, $billing, $bookings);
    $lines[] = "$id;{$c['type']};$status;$detail";
}
@mkdir($output, 0777, true);
file_put_contents("$output/results.txt", implode("\n", $lines) . "\n");
echo count($lines) . " commands executed; output in $output\n";
