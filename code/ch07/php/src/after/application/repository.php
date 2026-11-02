<?php
// Repository: one per aggregate. It saves the whole schedule, never a single booking.
namespace Morada\After\Application;

require_once __DIR__ . '/../domain/schedule.php';

use Morada\After\Domain\{DomainError, Schedule, UsagePolicy};

// In memory in the lab; chapter 16 keeps the schedules in a database
final class InMemorySchedules
{
    /** @var array<string, Schedule> */
    private array $schedules = [];

    /** @param array<string, UsagePolicy> $policies */
    public function __construct(array $policies)
    {
        foreach ($policies as $space => $policy) {
            $this->schedules[$space] = new Schedule($space, $policy);
        }
    }

    public function forSpace(string $space): Schedule
    {
        return $this->schedules[$space] ??
            throw new DomainError("unknown space: $space");
    }

    public function forBooking(string $booking): Schedule
    {
        foreach ($this->schedules as $schedule) {
            if ($schedule->has($booking)) {
                return $schedule;
            }
        }
        throw new DomainError('booking not found');
    }

    public function save(Schedule $schedule): void
    {
        $this->schedules[$schedule->space] = $schedule;
    }

    /** @return Schedule[] */
    public function all(): array
    {
        return array_values($this->schedules);
    }
}
