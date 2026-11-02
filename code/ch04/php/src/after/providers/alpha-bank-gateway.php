<?php
// Adapter: translates the Morada charge into the Alpha Bank API (ACH invoice).
namespace Morada\After\Providers;

require_once __DIR__ . '/../issuing/gateway.php';
require_once __DIR__ . '/../../shared/dates.php';
require_once __DIR__ . '/../../shared/money.php';
require_once __DIR__ . '/../../external/alpha-bank.php';

use Morada\After\Billing\Charge;
use Morada\After\Issuing\{Deadlines, PaymentGateway, Registration};
use Morada\External\AlphaBankClient;
use function Morada\Shared\{plainDollars, usDate};

final class AlphaBankGateway implements PaymentGateway
{
    public function __construct(private readonly AlphaBankClient $client) {}

    public function name(): string
    {
        return 'Alpha Bank';
    }

    public function register(Charge $charge, Deadlines $deadlines): Registration
    {
        $request = [
            'payer' => $charge->resident,
            'amount' => plainDollars($charge->total()),
            'dueDate' => usDate($deadlines->dueDate),
        ];
        if ($charge->discount() > 0) {
            $request['discount'] = [
                'amount' => plainDollars($charge->discount()),
                'until' => usDate($deadlines->discountUntil),
            ];
        }
        $response = $this->client->createInvoice($request);
        return new Registration($charge->unit, "invoice {$response['invoiceNumber']}");
    }
}
