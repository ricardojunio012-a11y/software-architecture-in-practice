<?php
// Original bookings module, written in a hurry for the first owners' meeting.
// DO NOT TOUCH without talking to George!!! (calculates weekend)
namespace Morada\Step1;

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

function processBookings($fn, $dir)
{
    global $approved, $log, $smtp;
    $d = json_decode(file_get_contents($fn), true);
    $out = [];
    $td = new \DateTimeImmutable('today', new \DateTimeZone('UTC'));
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
            $smtp->send(
                $u['email'],
                'Booking ' . $r['id'] . ' confirmed. Amount: $' . $vv,
            );
        } else {
            $ini = "{$r['id']};{$r['unit']};{$r['space']};{$r['date']}";
            $out[] = "$ini;declined;$msg";
            $smtp->send(
                $u['email'],
                'Booking ' . $r['id'] . ' declined (' . $msg . ')',
            );
        }
    }
    @mkdir($dir, 0777, true);
    file_put_contents($dir . '/bookings.txt', implode("\n", $out) . "\n");
    file_put_contents($dir . '/emails.txt', implode("\n", $log) . "\n");
}

processBookings($argv[1], $argv[2]);
