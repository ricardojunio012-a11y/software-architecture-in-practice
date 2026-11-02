<?php
// The types the calculator depends on. None of them knows a concrete rule.
namespace Morada\After\Billing;

// One item of the charge. Conditional: it applies only to payment by the discount date.
final readonly class Entry
{
    public function __construct(
        public string $code,
        public string $description,
        public int $amount,
        public bool $conditional = false,
    ) {}
}

// Each rule looks at the unit and at what was already posted, and returns what it adds.
interface Rule
{
    /** @param Entry[] $posted  @return Entry[] */
    public function apply(array $unit, array $posted): array;
}

function amountOf(array $posted, string $code): int
{
    $withCode = array_filter($posted, fn(Entry $e) => $e->code === $code);
    return array_sum(array_map(fn(Entry $e) => $e->amount, $withCode));
}
