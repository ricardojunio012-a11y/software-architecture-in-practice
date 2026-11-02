<?php
// Simulates the API of a card payment processor. Another company, another format:
// amounts in cents, ISO dates and a reference chosen by whoever creates the payment.
namespace Morada\External;

class EasyPayApi
{
    public function createPayment(array $payment): array
    {
        if ($payment['amountCents'] <= 0) {
            throw new \InvalidArgumentException('invalid amount');
        }
        return ['reference' => $payment['reference'], 'status' => 'ACTIVE'];
    }
}
