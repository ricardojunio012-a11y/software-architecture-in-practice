<?php
// How the resident pays. The calculation does not know which method it is.
namespace Morada\Billing;

interface PaymentMethod
{
    public function name(): string;

    public function generateCode(
        string $communityId,
        BillingPeriod $period,
        Charge $charge,
    ): string;
}

// Made-up code: in a real system, it would come from the payment processor
final class Invoice implements PaymentMethod
{
    public function name(): string
    {
        return 'Invoice';
    }

    public function generateCode(
        string $communityId,
        BillingPeriod $period,
        Charge $charge,
    ): string {
        $id = $charge->unit['id'];
        return "INV-$communityId-{$period->code}-$id-{$charge->total}";
    }
}
