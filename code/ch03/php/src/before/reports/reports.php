<?php
// Billing reports: delinquency and the financial report to owners.
namespace Morada\Before\Reports;

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../util/util.php';
require_once __DIR__ . '/../services/services.php';

use Morada\Before\Config\Config;
use Morada\Before\Services\Services;
use function Morada\Before\Util\daysLate;
use function Morada\Before\Util\dollars;
use function Morada\Before\Util\period;

function generateReport(string $type): string
{
    $name = Config::$data['community']['name'];
    if ($type === 'delinquency') {
        // Sorts the other module's list in place (content coupling)
        usort(Services::$charges, fn($a, $b) => $b['arrears'] <=> $a['arrears']);
        $lines = ['# Delinquency ' . period() . " - $name"];
        $lines[] = 'unit;resident;days;arrears;late_fee;interest;amount_due';
        $sum = [0, 0, 0, 0];
        foreach (array_filter(Services::$charges, fn($x) => $x['arrears'] > 0) as $c) {
            $due = $c['unit']['pastDue']['dueDate'];
            // recalculates what already exists
            $interest = Services::lateInterest($c['arrears'], $due);
            $values = [
                $c['arrears'],
                $c['lateFee'],
                $interest,
                $c['arrears'] + $c['lateFee'] + $interest,
            ];
            foreach ($values as $i => $v) {
                $sum[$i] += $v;
            }
            $lines[] = implode(';', [
                $c['unit']['id'],
                $c['unit']['resident']['name'],
                daysLate($due),
                ...array_map('Morada\Before\Util\dollars', $values),
            ]);
        }
        $lines[] = implode(';', [
            'total',
            '',
            '',
            ...array_map('Morada\Before\Util\dollars', $sum),
        ]);
        return implode("\n", $lines) . "\n";
    }
    // any other type becomes the financial report
    $dues = array_sum(array_column(Services::$charges, 'dues'));
    $reserve = array_sum(array_column(Services::$charges, 'reserve'));
    $lines = ['# Financial report ' . period() . " - $name"];
    $lines[] = 'income;monthly dues;' . dollars($dues);
    $lines[] = 'income;reserve fund;' . dollars($reserve);
    $totalExpenses = 0;
    foreach (Config::$data['expenses'] as $e) {
        $totalExpenses += $e['amountCents'];
        $lines[] = "expenses;{$e['category']};" . dollars($e['amountCents']);
    }
    $lines[] = 'expenses;total;' . dollars($totalExpenses);
    $balance = Config::$data['reserveFundOpeningBalanceCents'];
    $lines[] = 'reserve;opening balance;' . dollars($balance);
    $lines[] = 'reserve;projected balance;' . dollars($balance + $reserve);
    return implode("\n", $lines) . "\n";
}
