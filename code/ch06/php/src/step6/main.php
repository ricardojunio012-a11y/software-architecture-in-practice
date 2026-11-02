<?php
// Original bookings module, written in a hurry for the first owners' meeting.
// DO NOT TOUCH without talking to George!!! (calculates weekend)
// Step 6: the new rule goes into the legacy code without refactoring it. From step 2
// (seams only), it changes the minimum: a sprout (limit.php) and a wrapper (logRun).
namespace Morada\Step6;

require_once __DIR__ . '/limit.php';

$approved = [];
$log = [];

class Smtp
{
    public function send($to, $txt)
    {
        global $log;
        $log[] = 'to ' . $to . ': ' . $txt;
    }
}

$smtp = new Smtp();

function processBookingsWithoutLog($fn, $dir, $td = null, $mailer = null)
{
    global $approved, $log, $smtp;
    $td ??= new \DateTimeImmutable('today', new \DateTimeZone('UTC'));
    $mailer ??= $smtp;
    $d = json_decode(file_get_contents($fn), true);
    $out = [];
    foreach ($d['requests'] as $r) {
        $u = array_values(
            array_filter($d['units'], fn($x) => $x['id'] == $r['unit']),
        )[0];
        $s = array_values(
            array_filter($d['spaces'], fn($x) => $x['id'] == $r['space']),
        )[0];
        $ok = true;
        $msg = '';
        if ($u['inArrears']) {
            $ok = false;
            $msg = 'arrears';
        } else {
            $dt = new \DateTimeImmutable($r['date'], new \DateTimeZone('UTC'));
            $n = intdiv($dt->getTimestamp() - $td->getTimestamp(), 86400);
            if ($n < 2) {
                $ok = false;
                $msg = 'short notice';
            } else {
                foreach ($approved as $a) {
                    if ($a['space'] == $r['space'] && $a['date'] == $r['date']) {
                        $ok = false;
                        $msg = 'conflict';
                    }
                }
                // Sprout: the new rule is one call; the rest is in limit.php
                if ($ok && (new MonthlyLimit())->reached($r, $approved)) {
                    $ok = false;
                    $msg = 'monthly booking limit reached';
                }
            }
        }
        if ($ok) {
            // calculates the amount
            $v = $s['fee'];
            $dt2 = new \DateTimeImmutable($r['date'], new \DateTimeZone('UTC'));
            if ($dt2->format('w') == 6) {
                $v = $v + intdiv($v * 20, 100); // weekend
            }
            if ($r['guests'] > 50) {
                $v = $v + 5000;
            }
            $approved[] = $r;
            $vv = intdiv($v, 100) . '.' . sprintf('%02d', $v % 100);
            $ini = "{$r['id']};{$r['unit']};{$r['space']};{$r['date']}";
            $out[] = "$ini;approved;$vv";
            $mailer->send(
                $u['email'],
                'Booking ' . $r['id'] . ' confirmed. Amount: $' . $vv,
            );
        } else {
            $ini = "{$r['id']};{$r['unit']};{$r['space']};{$r['date']}";
            $out[] = "$ini;declined;$msg";
            $mailer->send(
                $u['email'],
                'Booking ' . $r['id'] . ' declined (' . $msg . ')',
            );
        }
    }
    @mkdir($dir, 0777, true);
    file_put_contents($dir . '/bookings.txt', implode("\n", $out) . "\n");
    file_put_contents($dir . '/emails.txt', implode("\n", $log) . "\n");
}

// Wrap method: the old name now calls the old code, untouched, and then the new
// behavior. Whoever called processBookings does not notice the change.
function processBookings($fn, $dir, $td = null, $mailer = null)
{
    $td ??= new \DateTimeImmutable('today', new \DateTimeZone('UTC'));
    processBookingsWithoutLog($fn, $dir, $td, $mailer);
    logRun($dir, $td);
}

// The board president wanted a log of each run, for the financial report to owners
function logRun($dir, \DateTimeImmutable $td)
{
    $lines = explode("\n", trim(file_get_contents($dir . '/bookings.txt')));
    $approved = count(array_filter($lines, fn($l) => str_contains($l, ';approved;')));
    $day = $td->format('Y-m-d');
    echo "log $day: " . count($lines) . " requests, $approved approved\n";
}

// Usage: php main.php <input.json> <output-folder> [--today YYYY-MM-DD]
// Runs only when the file is the program, not when another file includes it
if (realpath($argv[0] ?? '') === __FILE__) {
    [, $input, $output, $option, $date] = $argv + array_fill(0, 5, null);
    $today = new \DateTimeImmutable(
        $option === '--today' ? $date : 'today',
        new \DateTimeZone('UTC'),
    );
    processBookings($input, $output, $today);
}
