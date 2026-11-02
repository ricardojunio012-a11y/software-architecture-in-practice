<?php
// Financial report to owners: receives only what it needs, as parameters.
namespace Morada\After\FinancialReport;

require_once __DIR__ . '/../charges/charges.php';
require_once __DIR__ . '/../shared/dates.php';
require_once __DIR__ . '/../shared/money.php';

use Morada\After\Charges\Charge;
use function Morada\After\Shared\dollars;
use function Morada\After\Shared\monthLabel;

/**
 * @param Charge[] $charges
 * @param array<array{category: string, amountCents: int}> $expenses
 */
function financialReport(
    string $community,
    \DateTimeImmutable $today,
    array $charges,
    array $expenses,
    int $reserveOpeningBalance,
): string {
    $dues = array_sum(array_map(fn(Charge $c) => $c->dues, $charges));
    $reserve = array_sum(array_map(fn(Charge $c) => $c->reserve, $charges));
    $lines = ['# Financial report ' . monthLabel($today) . " - $community"];
    $lines[] = 'income;monthly dues;' . dollars($dues);
    $lines[] = 'income;reserve fund;' . dollars($reserve);
    foreach ($expenses as $e) {
        $lines[] = "expenses;{$e['category']};" . dollars($e['amountCents']);
    }
    $totalExpenses = array_sum(array_column($expenses, 'amountCents'));
    $lines[] = 'expenses;total;' . dollars($totalExpenses);
    $lines[] = 'reserve;opening balance;' . dollars($reserveOpeningBalance);
    $lines[] =
        'reserve;projected balance;' . dollars($reserveOpeningBalance + $reserve);
    return implode("\n", $lines) . "\n";
}
