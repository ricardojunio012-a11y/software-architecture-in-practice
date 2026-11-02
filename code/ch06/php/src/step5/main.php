<?php
// Usage: php main.php <input.json> <output-folder> [--today YYYY-MM-DD]
// Main does all the input and output; the bookings module does not touch files.
require_once __DIR__ . '/bookings.php';

use function Morada\Step5\{decide, notices, report};

[, $input, $output, $option, $date] = $argv + array_fill(0, 5, null);
$today = new DateTimeImmutable(
    $option === '--today' ? $date : 'today',
    new DateTimeZone('UTC'),
);
$decisions = decide(json_decode(file_get_contents($input), true), $today);

// The real email client would go here; in the lab, a file
$emails = array_map(fn($n) => "to {$n[0]}: {$n[1]}", notices($decisions));
@mkdir($output, 0777, true);
file_put_contents("$output/bookings.txt", implode("\n", report($decisions)) . "\n");
file_put_contents("$output/emails.txt", implode("\n", $emails) . "\n");
