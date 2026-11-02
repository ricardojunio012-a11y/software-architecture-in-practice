<?php
// Everything in one function: the rules in chained ifs and Alpha Bank called in the
// middle of the calculation. A new rule or another bank means changing this function.
namespace Morada\Before;

require_once __DIR__ . '/../shared/dates.php';
require_once __DIR__ . '/../shared/money.php';
require_once __DIR__ . '/../external/alpha-bank.php';

use Morada\External\AlphaBankClient;
use function Morada\Shared\{dateInMonth, daysBetween, monthDay, monthLabel, usDate};
use function Morada\Shared\{dollars, percentOf, plainDollars, shareOf};

function line(string $text, int $amount): string
{
    return '  ' .
        mb_str_pad($text, 40) .
        str_pad(dollars($amount), 10, ' ', STR_PAD_LEFT);
}

function issueCharges(array $data, \DateTimeImmutable $today): array
{
    $p = $data['policy'];
    $dueDate = dateInMonth($today, $p['dueDay']);
    $discountUntil = dateInMonth($today, $p['discountByDay']);
    $title = monthLabel($today) . ' - ' . $data['community']['name'];
    $bank = new AlphaBankClient();
    $charges = ["# Charges $title"];
    $registrations = ["# Registrations $title - Alpha Bank"];
    $registrations[] = 'unit;identifier;amount;discount';

    foreach ($data['units'] as $u) {
        $items = [];
        $expenses = $data['community']['monthlyExpensesCents'];
        $dues = shareOf($expenses, $u['shareMillionths']);
        $items[] = ['Monthly dues', $dues];
        $reserve = percentOf($dues, $p['reserveFundPercent']);
        $items[] = ["Reserve fund ({$p['reserveFundPercent']}%)", $reserve];
        if (!empty($u['boardPresident'])) {
            $items[] = ['Board president exemption', -$dues];
        }
        $d = $u['pastDue'];
        if ($d) {
            $a = $d['amountCents'];
            $days = daysBetween($d['dueDate'], $today);
            $interest = intdiv($a * $p['monthlyInterestPercent'] * $days + 1500, 3000);
            $due = monthDay($d['dueDate']);
            $items[] = ["Past-due balance (due $due)", $a];
            $items[] = [
                "Late fee ({$p['lateFeePercent']}%)",
                percentOf($a, $p['lateFeePercent']),
            ];
            $items[] = ["Interest ($days days)", $interest];
        }
        $total = array_sum(array_column($items, 1));
        $pd = $p['earlyDiscountPercent'];
        // No discount for the board president or for units in arrears (chapter 1 rule)
        $discount = !empty($u['boardPresident']) || $d ? 0 : percentOf($dues, $pd);

        array_push($charges, '', "{$u['id']} {$u['resident']['name']}");
        foreach ($items as [$text, $amount]) {
            $charges[] = line($text, $amount);
        }
        $by = monthDay($discountUntil);
        if ($discount > 0) {
            $charges[] = line("Discount by $by ($pd%)", -$discount);
        }
        $charges[] = line('Total', $total);
        if ($discount > 0) {
            $charges[] = line("Total with discount by $by", $total - $discount);
        }

        // The calculation knows the bank: changing banks means changing this function
        $request = [
            'payer' => $u['resident']['name'],
            'amount' => plainDollars($total),
            'dueDate' => usDate($dueDate),
        ];
        if ($discount > 0) {
            $request['discount'] = [
                'amount' => plainDollars($discount),
                'until' => usDate($discountUntil),
            ];
        }
        $invoice = $bank->createInvoice($request);
        $registrations[] =
            "{$u['id']};invoice {$invoice['invoiceNumber']};" .
            dollars($total) .
            ';' .
            dollars($discount);
    }
    return [implode("\n", $charges) . "\n", implode("\n", $registrations) . "\n"];
}
