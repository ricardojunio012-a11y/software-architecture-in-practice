<?php
// "Now the hard part": two requests for the same space and the same date
// arrive at the same time. The interleaving is forced, so the output is always
// the same: both go through the chain before either one saves.
namespace Morada;

require_once __DIR__ . '/state.php';
require_once __DIR__ . '/repository.php';

/**
 * @param BookingRequest[] $requests
 * @param callable(): array{0: Stage, 1: BookingRepository} $build
 */
function race(array $requests, callable $build): array
{
    $first = $requests[0];
    $lines = [
        "Simultaneous requests: {$first->space->name} on " . usDate($first->date),
    ];
    foreach ([false, true] as $guarded) {
        $lines[] = $guarded
            ? 'save only if the space is free, in a single operation:'
            : 'check, then save (check-then-act):';
        [$chain, $bookings] = $build();
        // 1. Both check: the space is free for both
        $approved = [];
        foreach ($requests as $r) {
            $d = $chain->evaluate($r);
            $text = $d->approved ? 'passed the chain' : $d->reason;
            $lines[] = "  {$r->id} {$r->unit->id}: $text";
            if ($d->approved) {
                $approved[] = $r;
            }
        }
        // 2. Both save
        foreach ($approved as $r) {
            $booking = new Booking($r);
            $saved = $guarded ? $bookings->saveIfFree($booking) : true;
            if (!$guarded) {
                $bookings->save($booking);
            }
            if ($saved) {
                $booking->approve();
            }
            $lines[] = "  {$r->id} " . ($saved ? 'saved' : 'rejected on save');
        }
        $n = 0;
        foreach ($requests as $r) {
            if ($bookings->find($r->id)?->state() === 'approved') {
                $n++;
            }
        }
        $result = $n === 1 ? '1 booking approved' : "$n bookings approved";
        $double = $n > 1 ? ' (double booking)' : '';
        $lines[] = "  result: $result$double";
    }
    return $lines;
}
