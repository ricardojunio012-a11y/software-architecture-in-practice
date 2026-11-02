<?php
// Billing services: calculates the charges and builds the outputs.
namespace Morada\Before\Services;

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../util/util.php';
require_once __DIR__ . '/../reports/reports.php';

use Morada\Before\Config\Config;
use function Morada\Before\Reports\generateReport;
use function Morada\Before\Util\daysLate;
use function Morada\Before\Util\dollars;
use function Morada\Before\Util\period;

final class Services
{
    // Internal list, but public: anyone can read and change it
    public static array $charges = [];

    public static function lateInterest(int $amount, string $dueDate): int
    {
        return intdiv($amount * daysLate($dueDate) + 1500, 3000);
    }

    public static function calculateAll(): void
    {
        $expenses = Config::$data['community']['monthlyExpensesCents'];
        foreach (Config::$data['units'] as $u) {
            $dues = intdiv($expenses * $u['shareMillionths'] + 500000, 1000000);
            $reserve = intdiv($dues * Config::$reservePercent + 50, 100);
            $p = $u['pastDue'];
            $arrears = $p ? $p['amountCents'] : 0;
            $lateFee = $p ? intdiv($arrears * Config::$lateFeePercent + 50, 100) : 0;
            $interest = $p ? self::lateInterest($arrears, $p['dueDate']) : 0;
            $total = $dues + $reserve + $arrears + $lateFee + $interest;
            self::$charges[] = compact(
                'dues',
                'reserve',
                'arrears',
                'lateFee',
                'interest',
                'total',
            ) + ['unit' => $u];
        }
    }

    // A parameter decides what the function does (control coupling)
    public static function generateOutput(string $type): string
    {
        if ($type !== 'charges') {
            return generateReport($type);
        }
        $lines = ['# Charges ' . period() . ' - ' . Config::$data['community']['name']];
        $lines[] = 'unit;resident;dues;reserve;arrears;late_fee;interest;total';
        foreach (self::$charges as $c) {
            $amounts = array_map('Morada\Before\Util\dollars', [
                $c['dues'],
                $c['reserve'],
                $c['arrears'],
                $c['lateFee'],
                $c['interest'],
                $c['total'],
            ]);
            $lines[] = implode(';', [
                $c['unit']['id'],
                $c['unit']['resident']['name'],
                ...$amounts,
            ]);
        }
        return implode("\n", $lines) . "\n";
    }
}
