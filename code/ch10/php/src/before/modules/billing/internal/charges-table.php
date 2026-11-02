<?php
// The Billing table: private data of the module. No other module should read it.
namespace Morada\Before\Modules\Billing\Internal;

final class ChargeRow
{
    public string $status = 'open';
    public int $installments = 1;

    public function __construct(
        public readonly string $charge,
        public readonly string $unit,
        public readonly int $amountCents,
        public readonly string $dueDate,
    ) {}
}

final class ChargesTable
{
    /** @var ChargeRow[] */
    public array $rows = [];

    public function find(string $charge): ChargeRow
    {
        foreach ($this->rows as $r) {
            if ($r->charge === $charge) {
                return $r;
            }
        }
        throw new \RuntimeException("charge $charge not found");
    }
}
