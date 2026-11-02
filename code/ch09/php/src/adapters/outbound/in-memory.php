<?php
// In-memory outbound adapter: fast and dependency-free, good for tests.
// Everything is gone when the process ends.
namespace Morada\Adapters\Outbound;

require_once __DIR__ . '/../../application/ports.php';

use Morada\Application\ScheduleRepository;
use Morada\Domain\{NotFoundError, Schedule};

final class InMemorySchedules implements ScheduleRepository
{
    /** @var array<string, Schedule> */
    private array $schedules = [];

    public function __construct(array $spaces)
    {
        foreach ($spaces as $s) {
            $this->schedules[$s->id] = new Schedule($s);
        }
    }

    public function all(): array
    {
        return array_values($this->schedules);
    }

    public function forSpace(string $space): Schedule
    {
        return $this->schedules[$space] ?? throw new NotFoundError('space not found');
    }

    public function forBooking(string $booking): Schedule
    {
        foreach ($this->schedules as $s) {
            foreach ($s->bookings() as $b) {
                if ($b->id === $booking) {
                    return $s;
                }
            }
        }
        throw new NotFoundError('booking not found');
    }

    // The in-memory schedule is the changed object itself: there is nothing to write
    public function save(Schedule $schedule): void {}
}
