<?php
// The month's charge report, for the management company.
namespace Morada\Step4;

final class ChargeReport
{
    private array $lines;

    public function __construct(string $community, BillingPeriod $period)
    {
        $this->lines = [
            "# Charges {$period->label} - $community - " . "due {$period->dueDate}",
            'unit;resident;dues;reserve;arrears;late_fee;interest;total;' .
            'total_by_5th;payment',
        ];
    }

    public function add(Charge $c, string $paymentCode): void
    {
        $values = array_map(
            [Money::class, 'dollars'],
            [$c->dues, $c->reserve, $c->arrears, $c->lateFee, $c->interest, $c->total],
        );
        $discounted = $c->totalBy5th === null ? '-' : Money::dollars($c->totalBy5th);
        $this->lines[] = implode(';', [
            $c->unit['id'],
            $c->unit['resident']['name'],
            ...$values,
            $discounted,
            $paymentCode,
        ]);
    }

    public function save(string $file): void
    {
        file_put_contents($file, implode("\n", $this->lines) . "\n");
    }
}
