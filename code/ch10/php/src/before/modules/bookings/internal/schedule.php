<?php
// Private data of Bookings: one space, one booking per day (simplified).
namespace Morada\Before\Modules\Bookings\Internal;

final class Schedule
{
    /** @var array<string, string> */
    private array $occupancy = [];

    public function __construct(private readonly array $spaces) {}

    public function occupant(string $space, string $date): ?string
    {
        if (!in_array($space, $this->spaces, true)) {
            throw new \RuntimeException("space $space does not exist");
        }
        return $this->occupancy["$space $date"] ?? null;
    }

    public function record(string $booking, string $space, string $date): void
    {
        $this->occupancy["$space $date"] = $booking;
    }
}
