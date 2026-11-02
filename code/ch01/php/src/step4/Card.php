<?php
// New payment method: added without touching the calculation or the invoice.
namespace Morada\Step4;

// Made-up code: in a real system, it would come from the card payment processor
final class Card implements PaymentMethod
{
    public function name(): string
    {
        return 'Card payment';
    }

    public function generateCode(
        string $communityId,
        BillingPeriod $period,
        Charge $charge,
    ): string {
        $id = $charge->unit['id'];
        return "CARD-$communityId-{$period->code}-$id-{$charge->total}";
    }
}
