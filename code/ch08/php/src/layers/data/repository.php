<?php
// Data layer: where the schedules are stored. Today, in memory; in chapter 16,
// in a database. The layers above do not notice the change.
namespace Morada\Layers\Data;

require_once __DIR__ . '/../domain/domain.php';

use Morada\Layers\Domain\{Schedule, Space, NotFoundError};

final class ScheduleRepository
{
    /** @var array<string, Schedule> */
    private array $schedules = [];

    /** @param Space[] $spaces */
    public function __construct(array $spaces)
    {
        foreach ($spaces as $s) {
            $this->schedules[$s->id] = new Schedule($s);
        }
    }

    /** @return Schedule[] */
    public function all(): array
    {
        return array_values($this->schedules);
    }

    public function forSpace(string $id): Schedule
    {
        return $this->schedules[$id] ?? throw new NotFoundError('space not found');
    }

    public function forBooking(string $id): Schedule
    {
        foreach ($this->schedules as $schedule) {
            if ($schedule->has($id)) {
                return $schedule;
            }
        }
        throw new NotFoundError('booking not found');
    }
}
