<?php
// Domain layer: the booking rules. It knows nothing about HTTP, JSON or databases.
namespace Morada\Layers\Domain;

class RuleViolationError extends \RuntimeException {}
class NotFoundError extends \RuntimeException {}

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

function days(string $from, string $to): int
{
    return intdiv(strtotime("$to UTC") - strtotime("$from UTC"), 86400);
}

final class Schedule
{
    /** @var Booking[] */
    private array $bookings = [];

    public function __construct(public readonly Space $space) {}

    public function book(
        string $id,
        string $unit,
        string $date,
        int $start,
        int $end,
        string $today,
    ): Booking {
        if ($end <= $start) {
            throw new RuleViolationError('invalid time slot');
        }
        if (days($today, $date) < $this->space->minNoticeDays) {
            throw new RuleViolationError('minimum notice not met');
        }
        foreach ($this->bookings as $b) {
            if ($b->date === $date && $b->start < $end && $start < $b->end) {
                throw new RuleViolationError("time slot overlaps {$b->id}");
            }
        }
        $base = $this->space->feeCents;
        $weekend = (int) gmdate('N', strtotime("$date UTC")) >= 6;
        $fee = $weekend ? $base + intdiv($base * 20 + 50, 100) : $base;
        $booking = new Booking($id, $unit, $date, $start, $end, $fee);
        $this->bookings[] = $booking;
        return $booking;
    }

    // Returns the cancellation fee in cents: 50% of the fee if less than 2 days are left
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

    public function has(string $id): bool
    {
        foreach ($this->bookings as $b) {
            if ($b->id === $id) {
                return true;
            }
        }
        return false;
    }

    /** @return Booking[] */
    public function bookings(): array
    {
        return $this->bookings;
    }
}
