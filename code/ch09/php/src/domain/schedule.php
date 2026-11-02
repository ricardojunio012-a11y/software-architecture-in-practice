<?php
// The center of the hexagon: the booking rules. Imports nothing outside the domain.
namespace Morada\Domain;

class RuleViolatedError extends \RuntimeException {}
class NotFoundError extends \RuntimeException {}

// $1,234.56
function dollars(int $cents): string
{
    return '$' . number_format($cents / 100, 2, '.', ',');
}

final readonly class Space
{
    public function __construct(
        public string $id,
        public int $feeCents,
        public int $minNoticeDays,
    ) {}
}

final readonly class Booking
{
    public function __construct(
        public string $id,
        public string $unit,
        public string $date,
        public int $start,
        public int $end,
        public int $feeCents,
    ) {}
}

// 2026-03-14 14:00-22:00
function slot(Booking $b): string
{
    return sprintf('%s %02d:00-%02d:00', $b->date, $b->start, $b->end);
}

function days(string $from, string $to): int
{
    return intdiv(strtotime("$to UTC") - strtotime("$from UTC"), 86400);
}

final class Schedule
{
    /** @var Booking[] */
    private array $bookings;

    // A repository that loads a saved schedule passes in the existing bookings
    public function __construct(public readonly Space $space, array $bookings = [])
    {
        $this->bookings = $bookings;
    }

    public function book(
        string $id,
        string $unit,
        string $date,
        int $start,
        int $end,
        string $today,
    ): Booking {
        if ($end <= $start) {
            throw new RuleViolatedError('invalid time slot');
        }
        if (days($today, $date) < $this->space->minNoticeDays) {
            throw new RuleViolatedError('minimum notice not met');
        }
        foreach ($this->bookings as $b) {
            if ($b->date === $date && $b->start < $end && $start < $b->end) {
                throw new RuleViolatedError("time slot overlaps {$b->id}");
            }
        }
        $base = $this->space->feeCents;
        $weekend = (int) gmdate('N', strtotime("$date UTC")) >= 6;
        $fee = $weekend ? $base + intdiv($base * 20 + 50, 100) : $base;
        $booking = new Booking($id, $unit, $date, $start, $end, $fee);
        $this->bookings[] = $booking;
        return $booking;
    }

    // Returns the cancellation fee in cents: 50% of the fee if less than 2 days remain
    public function cancel(string $id, string $today): int
    {
        foreach ($this->bookings as $i => $b) {
            if ($b->id === $id) {
                array_splice($this->bookings, $i, 1);
                return days($today, $b->date) < 2
                    ? intdiv($b->feeCents * 50 + 50, 100)
                    : 0;
            }
        }
        throw new NotFoundError('booking not found');
    }

    // In date and time order, whatever the order in which they were stored
    /** @return Booking[] */
    public function bookings(): array
    {
        $list = $this->bookings;
        usort($list, fn($a, $b) => [$a->date, $a->start] <=> [$b->date, $b->start]);
        return $list;
    }
}
