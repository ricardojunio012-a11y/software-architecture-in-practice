<?php
// The charge of one unit. Information expert (GRASP): whoever has the entries is the
// one who calculates the totals.
namespace Morada\After\Billing;

require_once __DIR__ . '/types.php';

final readonly class Charge
{
    /** @param Entry[] $entries */
    public function __construct(
        public string $unit,
        public string $resident,
        public array $entries,
    ) {}

    public function total(): int
    {
        return $this->sum(false);
    }

    // Conditional discount, as a positive amount
    public function discount(): int
    {
        return -$this->sum(true);
    }

    private function sum(bool $conditional): int
    {
        $total = 0;
        foreach ($this->entries as $e) {
            if ($e->conditional === $conditional) {
                $total += $e->amount;
            }
        }
        return $total;
    }
}
