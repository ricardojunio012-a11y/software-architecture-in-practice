<?php
// Bookings module. Step 3: names that say what things are and extracted
// functions (Rename Variable, Extract Function). The structure is still the original.
namespace Morada\Step3;

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
    return (new \DateTimeImmutable($isoDate, new \DateTimeZone('UTC')))->format('w') ==
        6;
}

function bookingAmount(array $space, array $request): int
{
    $amount = $space['fee'];
    if (isSaturday($request['date'])) {
        $amount = $amount + intdiv($amount * 20, 100);
    }
    if ($request['guests'] > 50) {
        $amount = $amount + 5000;
    }
    return $amount;
}

function dollars(int $cents): string
{
    return intdiv($cents, 100) . '.' . sprintf('%02d', $cents % 100);
}

function processBookings($file, $dir, $today = null, $mailer = null)
{
    global $approved, $log, $smtp;
    $today ??= new \DateTimeImmutable('today', new \DateTimeZone('UTC'));
    $mailer ??= $smtp;
    $data = json_decode(file_get_contents($file), true);
    $lines = [];
    foreach ($data['requests'] as $request) {
        $unit = array_values(
            array_filter($data['units'], fn($u) => $u['id'] == $request['unit']),
        )[0];
        $space = array_values(
            array_filter($data['spaces'], fn($s) => $s['id'] == $request['space']),
        )[0];
        $accepted = true;
        $reason = '';
        if ($unit['inArrears']) {
            $accepted = false;
            $reason = 'arrears';
        } else {
            if (daysUntil($request['date'], $today) < 2) {
                $accepted = false;
                $reason = 'short notice';
            } else {
                foreach ($approved as $booking) {
                    if (
                        $booking['space'] == $request['space'] &&
                        $booking['date'] == $request['date']
                    ) {
                        $accepted = false;
                        $reason = 'conflict';
                    }
                }
            }
        }
        $head =
            "{$request['id']};{$request['unit']};" .
            "{$request['space']};{$request['date']}";
        if ($accepted) {
            $amount = dollars(bookingAmount($space, $request));
            $approved[] = $request;
            $lines[] = "$head;approved;$amount";
            $mailer->send(
                $unit['email'],
                "Booking {$request['id']} confirmed. Amount: \$$amount",
            );
        } else {
            $lines[] = "$head;declined;$reason";
            $mailer->send(
                $unit['email'],
                "Booking {$request['id']} declined ($reason)",
            );
        }
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
