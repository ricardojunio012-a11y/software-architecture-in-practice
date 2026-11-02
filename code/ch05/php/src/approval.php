<?php
// Chain of Responsibility: each stage checks one rule and, if the request passes,
// hands it to the next. The skeleton of evaluate() is a Template Method.
namespace Morada;

require_once __DIR__ . '/repository.php';

abstract class Stage
{
    private ?Stage $next = null;

    // Returns the next stage, for chaining: $a->andThen($b)->andThen($c)
    public function andThen(Stage $next): Stage
    {
        $this->next = $next;
        return $next;
    }

    public function evaluate(BookingRequest $request): Decision
    {
        $reason = $this->check($request);
        if ($reason !== null) {
            return new Decision(false, $reason);
        }
        return $this->next?->evaluate($request) ?? new Decision(true);
    }

    // Each stage gives the reason for rejecting, or null if the request passed
    abstract protected function check(BookingRequest $request): ?string;
}

final class UnitInGoodStanding extends Stage
{
    protected function check(BookingRequest $request): ?string
    {
        return $request->unit->inArrears ? 'unit in arrears' : null;
    }
}

final class MinimumNotice extends Stage
{
    public function __construct(private readonly \DateTimeImmutable $today) {}

    protected function check(BookingRequest $request): ?string
    {
        $minimum = $request->space->minNoticeDays;
        if (daysBetween($this->today, $request->date) >= $minimum) {
            return null;
        }
        return "minimum notice of $minimum days";
    }
}

final class SpaceAvailable extends Stage
{
    public function __construct(private readonly BookingRepository $bookings) {}

    protected function check(BookingRequest $request): ?string
    {
        $taken = $this->bookings->isTaken($request->space->id, $request->date);
        return $taken ? 'space already booked on this date' : null;
    }
}

final class MonthlyLimit extends Stage
{
    public function __construct(private readonly BookingRepository $bookings) {}

    protected function check(BookingRequest $request): ?string
    {
        $made = $this->bookings->countInMonth(
            $request->unit->id,
            $request->space->id,
            substr($request->date, 0, 7),
        );
        if ($made < $request->space->monthlyLimit) {
            return null;
        }
        return 'monthly booking limit reached';
    }
}
