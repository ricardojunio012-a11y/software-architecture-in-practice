<?php
// Application service: translates a command into calls to the domain. It loads the
// aggregate, asks it to do the work, saves it and publishes the events. No business rule.
namespace Morada\After\Application;

require_once __DIR__ . '/repository.php';

use Morada\After\Domain\{DomainError, Schedule, TimeSlot};

final readonly class Result
{
    public function __construct(
        public string $booking,
        public string $command,
        public string $status,
        public string $detail,
    ) {}
}

final class BookingService
{
    /** @param callable $publish */
    public function __construct(
        private readonly InMemorySchedules $schedules,
        private $publish,
    ) {}

    public function execute(array $c): Result
    {
        try {
            return $c['type'] === 'book' ? $this->book($c) : $this->cancel($c);
        } catch (DomainError $error) {
            $status = $c['type'] === 'book' ? 'rejected' : 'not canceled';
            return new Result($c['booking'], $c['type'], $status, $error->getMessage());
        }
    }

    private function book(array $c): Result
    {
        $slot = new TimeSlot($c['date'], $c['start'], $c['end']);
        $schedule = $this->schedules->forSpace($c['space']);
        $booking = $schedule->book($c['booking'], $c['unit'], $slot, $c['requestedOn']);
        $this->save($schedule);
        return new Result(
            $c['booking'],
            $c['type'],
            'confirmed',
            (string) $booking->fee,
        );
    }

    private function cancel(array $c): Result
    {
        $schedule = $this->schedules->forBooking($c['booking']);
        $fee = $schedule->cancel($c['booking'], $c['requestedOn']);
        $this->save($schedule);
        $detail = $fee->cents > 0 ? "cancellation fee $fee" : 'no cancellation fee';
        return new Result($c['booking'], $c['type'], 'canceled', $detail);
    }

    private function save(Schedule $schedule): void
    {
        $this->schedules->save($schedule);
        foreach ($schedule->collectEvents() as $event) {
            ($this->publish)($event);
        }
    }
}
