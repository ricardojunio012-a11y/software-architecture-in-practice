<?php
// Value object: a period of use within one day. The end never comes before the start.
namespace Morada\After\Domain;

require_once __DIR__ . '/error.php';

final readonly class TimeSlot
{
    public function __construct(public string $date, public int $start, public int $end)
    {
        if ($end <= $start) {
            throw new DomainError('invalid time slot: the end must be after the start');
        }
    }

    public function overlaps(TimeSlot $other): bool
    {
        return $this->date === $other->date &&
            $this->start < $other->end &&
            $other->start < $this->end;
    }

    public function month(): string
    {
        return substr($this->date, 0, 7);
    }

    public function daysSince(string $day): int
    {
        return intdiv(
            strtotime($this->date . ' UTC') - strtotime($day . ' UTC'),
            86400,
        );
    }

    public function isWeekend(): bool
    {
        $weekday = (int) gmdate('w', strtotime($this->date . ' UTC'));
        return $weekday === 0 || $weekday === 6;
    }

    // 2026-03-14 14:00-22:00
    public function __toString(): string
    {
        return sprintf('%s %02d:00-%02d:00', $this->date, $this->start, $this->end);
    }
}
