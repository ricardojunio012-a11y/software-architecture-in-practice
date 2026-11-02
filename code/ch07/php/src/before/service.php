<?php
// Service that holds every rule. The rules only apply if whoever changes the data
// remembers to go through here; nothing stops other code from changing bookings directly.
namespace Morada\Before;

require_once __DIR__ . '/model.php';

function days(string $from, string $to): int
{
    return intdiv(strtotime($to . ' UTC') - strtotime($from . ' UTC'), 86400);
}

function format(int $cents): string
{
    return '$' . number_format(intdiv($cents, 100)) . sprintf('.%02d', $cents % 100);
}

function hours(int $start, int $end): string
{
    return sprintf('%02d:00-%02d:00', $start, $end);
}

function book(array $c, array $space, array &$events): string
{
    if ($c['end'] <= $c['start']) {
        return 'rejected;invalid time slot: the end must be after the start';
    }
    if (days($c['requestedOn'], $c['date']) < $space['minNoticeDays']) {
        return 'rejected;minimum notice not met';
    }
    foreach (Bookings::$all as $b) {
        $sameTime =
            $b->date === $c['date'] && $b->start < $c['end'] && $c['start'] < $b->end;
        if ($b->space === $c['space'] && $b->status === 'confirmed' && $sameTime) {
            return "rejected;time slot overlaps {$b->id}";
        }
    }
    $thisMonth = array_filter(
        Bookings::$all,
        fn($b) => $b->space === $c['space'] &&
            $b->unit === $c['unit'] &&
            $b->status === 'confirmed' &&
            substr($b->date, 0, 7) === substr($c['date'], 0, 7),
    );
    if (count($thisMonth) >= $space['monthlyLimit']) {
        return "rejected;unit's monthly limit reached";
    }

    $fee = $space['feeCents'];
    $weekday = (int) gmdate('w', strtotime($c['date'] . ' UTC'));
    if ($weekday === 0 || $weekday === 6) {
        $fee += intdiv($fee * 20 + 50, 100);
    }
    $b = new Booking();
    $b->id = $c['booking'];
    $b->unit = $c['unit'];
    $b->space = $c['space'];
    $b->date = $c['date'];
    $b->start = $c['start'];
    $b->end = $c['end'];
    $b->feeCents = $fee;
    Bookings::$all[] = $b;
    $slot = "{$c['date']} " . hours($c['start'], $c['end']);
    $events[] =
        "BookingConfirmed;{$b->id};{$b->space};$slot;{$b->unit};" . format($fee);
    return 'confirmed;' . format($fee);
}

function cancel(array $c, array &$events): string
{
    $found = array_values(
        array_filter(Bookings::$all, fn($x) => $x->id === $c['booking']),
    );
    $b = $found[0] ?? null;
    if (!$b) {
        return 'not canceled;booking not found';
    }
    if ($b->status !== 'confirmed') {
        return 'not canceled;booking is not confirmed';
    }
    $b->status = 'canceled';
    $fee =
        days($c['requestedOn'], $b->date) < 2 ? intdiv($b->feeCents * 50 + 50, 100) : 0;
    $detail = $fee > 0 ? 'cancellation fee ' . format($fee) : 'no cancellation fee';
    $events[] = "BookingCanceled;{$b->id};$detail";
    return "canceled;$detail";
}
