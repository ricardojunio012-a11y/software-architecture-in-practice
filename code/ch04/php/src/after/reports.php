<?php
// Reports: only read charges and registrations. A new rule shows up here on its own.
namespace Morada\After\Reports;

require_once __DIR__ . '/issuing/gateway.php';
require_once __DIR__ . '/../shared/dates.php';
require_once __DIR__ . '/../shared/money.php';

use Morada\After\Issuing\Deadlines;
use function Morada\Shared\{dollars, monthDay};

function line(string $text, int $amount): string
{
    return '  ' .
        mb_str_pad($text, 40) .
        str_pad(dollars($amount), 10, ' ', STR_PAD_LEFT);
}

function chargeReport(string $title, array $charges, Deadlines $deadlines): string
{
    $lines = ["# Charges $title"];
    foreach ($charges as $c) {
        array_push($lines, '', "{$c->unit} {$c->resident}");
        foreach ($c->entries as $e) {
            $lines[] = line($e->description, $e->amount);
        }
        $lines[] = line('Total', $c->total());
        if ($c->discount() > 0) {
            $text = 'Total with discount by ' . monthDay($deadlines->discountUntil);
            $lines[] = line($text, $c->total() - $c->discount());
        }
    }
    return implode("\n", $lines) . "\n";
}

function registrationReport(
    string $title,
    string $gateway,
    array $charges,
    array $registrations,
): string {
    $lines = ["# Registrations $title - $gateway"];
    $lines[] = 'unit;identifier;amount;discount';
    foreach ($registrations as $i => $r) {
        $c = $charges[$i];
        $lines[] =
            "{$r->unit};{$r->identifier};" .
            dollars($c->total()) .
            ';' .
            dollars($c->discount());
    }
    return implode("\n", $lines) . "\n";
}
