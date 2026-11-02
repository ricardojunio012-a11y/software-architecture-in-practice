<?php
// Bookings subscribes to PaymentConfirmed: the booking awaiting payment is confirmed.
// The subscriber is idempotent, because the broker delivers "at least once".
namespace Morada\Modules;

final class Bookings
{
    private array $bookings = [];
    private array $processed = [];
    public array $log = [];

    public function __construct(array $initial)
    {
        foreach ($initial as $b) {
            $this->bookings[$b['booking']] = $b + ['status' => 'awaiting payment'];
        }
    }

    public function onPaymentConfirmed(array $e): void
    {
        if (isset($this->processed[$e['event']])) {
            $this->log[] = "bookings ignored {$e['event']} (duplicate)";
            return;
        }
        $this->processed[$e['event']] = true;
        $this->bookings[$e['booking']]['status'] = 'confirmed';
        $this->log[] = "bookings received {$e['event']}: {$e['booking']} confirmed";
    }

    public function lines(): array
    {
        return array_map(
            fn($b) => implode(';', [
                $b['booking'],
                $b['unit'],
                $b['space'],
                $b['date'],
                $b['status'],
            ]),
            array_values($this->bookings),
        );
    }
}
