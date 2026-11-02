<?php
// Adapter: translates the Morada charge into the EasyPay API (card payment).
namespace Morada\After\Providers;

require_once __DIR__ . '/../issuing/gateway.php';
require_once __DIR__ . '/../../external/easy-pay.php';

use Morada\After\Billing\Charge;
use Morada\After\Issuing\{Deadlines, PaymentGateway, Registration};
use Morada\External\EasyPayApi;

final class EasyPayGateway implements PaymentGateway
{
    public function __construct(private readonly EasyPayApi $api) {}

    public function name(): string
    {
        return 'EasyPay';
    }

    public function register(Charge $charge, Deadlines $deadlines): Registration
    {
        // One reference per month and unit: MORADA202603A101
        $month = str_replace('-', '', substr($deadlines->dueDate, 0, 7));
        $request = [
            'reference' => 'MORADA' . $month . str_replace('-', '', $charge->unit),
            'amountCents' => $charge->total(),
            'expiresOn' => $deadlines->dueDate,
        ];
        if ($charge->discount() > 0) {
            $request['discountCents'] = $charge->discount();
            $request['discountUntil'] = $deadlines->discountUntil;
        }
        $response = $this->api->createPayment($request);
        return new Registration($charge->unit, "card {$response['reference']}");
    }
}
