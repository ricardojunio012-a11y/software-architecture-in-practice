<?php
// Public API of Billing: the only door the other modules may use.
namespace Morada\After\Modules\Billing;

require_once __DIR__ . '/internal/charges-table.php';

use Morada\After\Modules\Billing\Internal\{ChargeRow, ChargesTable};

function dollars(int $cents): string
{
    return '$' . number_format($cents / 100, 2, '.', ',');
}

final class Billing
{
    public function __construct(private readonly ChargesTable $table) {}

    public function issue(
        string $charge,
        string $unit,
        int $amountCents,
        string $dueDate,
    ): string {
        $this->table->rows[] = new ChargeRow($charge, $unit, $amountCents, $dueDate);
        return "$unit " . dollars($amountCents) . " due $dueDate";
    }

    public function pay(string $charge, string $on): string
    {
        $this->table->find($charge)->status = 'paid';
        return "on $on";
    }

    public function split(string $charge, int $installments): string
    {
        $row = $this->table->find($charge);
        $row->status = 'split';
        $row->installments = $installments;
        return "$installments installments";
    }

    // Delinquency rule: a charge split into installments under an agreement is not debt
    public function unitInGoodStanding(string $unit, string $today): bool
    {
        foreach ($this->table->rows as $r) {
            if ($r->unit === $unit && $r->status === 'open' && $r->dueDate < $today) {
                return false;
            }
        }
        return true;
    }
}
