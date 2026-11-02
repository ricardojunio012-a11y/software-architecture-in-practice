<?php
// Aggregate: the schedule of a space is the consistency boundary. The rules that
// involve several bookings (no overlaps, a limit per unit) can only be guaranteed by
// whoever knows all of them. Nobody outside changes a booking without going through here.
namespace Morada\After\Domain;

require_once __DIR__ . '/booking.php';
require_once __DIR__ . '/events.php';

final readonly class UsagePolicy
{
    public function __construct(
        public Money $fee,
        public int $minNoticeDays,
        public int $monthlyLimit,
    ) {}
}

final class Schedule
{
    private const WEEKEND_SURCHARGE_PERCENT = 20;
    private const CANCELLATION_FEE_PERCENT = 50;
    private const FREE_CANCELLATION_DAYS = 2;

    /** @var Booking[] */
    private array $bookings = [];
    private array $events = [];

    public function __construct(
        public readonly string $space,
        private readonly UsagePolicy $policy,
    ) {}

    public function book(
        string $id,
        string $unit,
        TimeSlot $slot,
        string $today,
    ): Booking {
        if ($slot->daysSince($today) < $this->policy->minNoticeDays) {
            throw new DomainError('minimum notice not met');
        }
        foreach ($this->active() as $b) {
            if ($b->slot->overlaps($slot)) {
                throw new DomainError("time slot overlaps {$b->id}");
            }
        }
        $thisMonth = array_filter(
            $this->active(),
            fn(Booking $b) => $b->unit === $unit &&
                $b->slot->month() === $slot->month(),
        );
        if (count($thisMonth) >= $this->policy->monthlyLimit) {
            throw new DomainError("unit's monthly limit reached");
        }
        $booking = new Booking($id, $unit, $slot, $this->feeFor($slot));
        $this->bookings[] = $booking;
        $this->events[] = new BookingConfirmed(
            $id,
            $this->space,
            $slot,
            $unit,
            $booking->fee,
        );
        return $booking;
    }

    public function cancel(string $id, string $today): Money
    {
        $booking = null;
        foreach ($this->bookings as $b) {
            if ($b->id === $id) {
                $booking = $b;
            }
        }
        if ($booking === null) {
            throw new DomainError('booking not found');
        }
        $booking->cancel();
        $lastMinute = $booking->slot->daysSince($today) < self::FREE_CANCELLATION_DAYS;
        $cancellationFee = $lastMinute
            ? $booking->fee->percent(self::CANCELLATION_FEE_PERCENT)
            : Money::zero();
        $this->events[] = new BookingCanceled($id, $cancellationFee);
        return $cancellationFee;
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
    public function active(): array
    {
        return array_values(
            array_filter($this->bookings, fn(Booking $b) => $b->isActive()),
        );
    }

    // Whoever saves the aggregate collects the events to publish them afterward
    public function collectEvents(): array
    {
        $events = $this->events;
        $this->events = [];
        return $events;
    }

    private function feeFor(TimeSlot $slot): Money
    {
        $fee = $this->policy->fee;
        if (!$slot->isWeekend()) {
            return $fee;
        }
        return $fee->add($fee->percent(self::WEEKEND_SURCHARGE_PERCENT));
    }
}
