<?php
// Integration event published by Billing. It carries the data the subscribers need
// (event-carried state transfer), so they do not have to query Billing.
namespace Morada;

// The event identifier is stable: the same payment always produces the same event
function eventFor(array $p): array
{
    return [
        'event' => "E-{$p['payment']}",
        'type' => 'PaymentConfirmed',
        'payment' => $p['payment'],
        'unit' => $p['unit'],
        'booking' => $p['booking'],
        'amountCents' => $p['amountCents'],
    ];
}

function dollars(int $cents): string
{
    return '$' . number_format($cents / 100, 2, '.', ',');
}
