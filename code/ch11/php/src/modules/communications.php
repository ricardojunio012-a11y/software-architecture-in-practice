<?php
// Communications subscribes to the same event and notifies the resident. It does not
// know Bookings: everything it needs came inside the event.
namespace Morada\Modules;

require_once __DIR__ . '/../events.php';

use function Morada\dollars;

final class Communications
{
    private array $processed = [];
    public array $notices = [];
    public array $log = [];

    public function onPaymentConfirmed(array $e): void
    {
        if (isset($this->processed[$e['event']])) {
            $this->log[] = "communications ignored {$e['event']} (duplicate)";
            return;
        }
        $this->processed[$e['event']] = true;
        $amount = dollars($e['amountCents']);
        $this->notices[] =
            "{$e['unit']}: payment {$e['payment']} of $amount received; " .
            "booking {$e['booking']} confirmed";
        $this->log[] = "communications received {$e['event']}: notified {$e['unit']}";
    }
}
