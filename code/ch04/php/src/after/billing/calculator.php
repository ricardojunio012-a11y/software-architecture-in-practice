<?php
// Open for extension, closed for modification: a new rule is a new class, handed in
// through the constructor. This class does not change.
namespace Morada\After\Billing;

require_once __DIR__ . '/charge.php';

final class ChargeCalculator
{
    /** @param Rule[] $rules */
    public function __construct(private readonly array $rules) {}

    public function calculate(array $unit): Charge
    {
        $posted = [];
        foreach ($this->rules as $rule) {
            array_push($posted, ...$rule->apply($unit, $posted));
        }
        return new Charge($unit['id'], $unit['resident']['name'], $posted);
    }
}
