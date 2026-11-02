<?php
// Bookings module. Step 4: conditionals and magic numbers (Replace Nested
// Conditional with Guard Clauses, Replace Magic Literal, Replace Loop with Pipeline).
namespace Morada\Step4;

const MIN_NOTICE_DAYS = 2;
const SATURDAY_SURCHARGE_PERCENT = 20;
const GUEST_LIMIT = 50;
const EXTRA_CLEANING_FEE = 5000; // cents

$approved = [];
$log = [];

class Smtp
{
    public function send($to, $text)
    {
        global $log;
        $log[] = 'to ' . $to . ': ' . $text;
    }
}

$smtp = new Smtp();

function daysUntil(string $isoDate, \DateTimeImmutable $today): int
{
    $date = new \DateTimeImmutable($isoDate, new \DateTimeZone('UTC'));
    return intdiv($date->getTimestamp() - $today->getTimestamp(), 86400);
}

// The original comment said "weekend", but the code only checks Saturday
function isSaturday(string $isoDate): bool
{
    return (new \DateTimeImmutable($isoDate, new \DateTimeZone('UTC')))->format('w') ===
        '6';
}

function bookingAmount(array $space, array $request): int
{
    $amount = $space['fee'];
    if (isSaturday($request['date'])) {
        $amount += intdiv($amount * SATURDAY_SURCHARGE_PERCENT, 100);
    }
    if ($request['guests'] > GUEST_LIMIT) {
        $amount += EXTRA_CLEANING_FEE;
    }
    return $amount;
}

function dollars(int $cents): string
{
    return intdiv($cents, 100) . '.' . sprintf('%02d', $cents % 100);
}

// Guard clauses: the first rule that fails returns the reason
function declineReason(array $request, array $unit, \DateTimeImmutable $today): ?string
{
    global $approved;
    if ($unit['inArrears']) {
        return 'arrears';
    }
    if (daysUntil($request['date'], $today) < MIN_NOTICE_DAYS) {
        return 'short notice';
    }
    foreach ($approved as $b) {
        if ($b['space'] === $request['space'] && $b['date'] === $request['date']) {
            return 'conflict';
        }
    }
    return null;
}

function processBookings($file, $dir, $today = null, $mailer = null)
{
    global $approved, $log, $smtp;
    $today ??= new \DateTimeImmutable('today', new \DateTimeZone('UTC'));
    $mailer ??= $smtp;
    $data = json_decode(file_get_contents($file), true);
    $units = array_column($data['units'], null, 'id');
    $spaces = array_column($data['spaces'], null, 'id');
    $lines = [];
    foreach ($data['requests'] as $request) {
        $unit = $units[$request['unit']];
        $reason = declineReason($request, $unit, $today);
        $head =
            "{$request['id']};{$request['unit']};" .
            "{$request['space']};{$request['date']}";
        if ($reason !== null) {
            $lines[] = "$head;declined;$reason";
            $mailer->send(
                $unit['email'],
                "Booking {$request['id']} declined ($reason)",
            );
            continue;
        }
        $amount = dollars(bookingAmount($spaces[$request['space']], $request));
        $approved[] = $request;
        $lines[] = "$head;approved;$amount";
        $mailer->send(
            $unit['email'],
            "Booking {$request['id']} confirmed. Amount: \$$amount",
        );
    }
    @mkdir($dir, 0777, true);
    file_put_contents($dir . '/bookings.txt', implode("\n", $lines) . "\n");
    file_put_contents($dir . '/emails.txt', implode("\n", $log) . "\n");
}

// Usage: php main.php <input.json> <output-folder> [--today YYYY-MM-DD]
[, $input, $output, $option, $date] = $argv + array_fill(0, 5, null);
$today = new \DateTimeImmutable(
    $option === '--today' ? $date : 'today',
    new \DateTimeZone('UTC'),
);
processBookings($input, $output, $today);
