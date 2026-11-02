<?php
// The Morada back end (the monolith): Front Desk handles packages and visitors;
// Bookings knows who the guests of each party are. Neither one knows about screens.
namespace Morada;

final class FrontDesk
{
    public array $packages = [];
    public array $visitors = [];

    public function __construct(array $packages)
    {
        foreach ($packages as $p) {
            $this->packages[$p['id']] = $p + [
                'status' => 'at front desk',
                'version' => 1,
            ];
        }
    }

    // Optimistic concurrency: changes only if nobody changed it since the seen version
    public function change(
        string $id,
        string $status,
        int $seenVersion,
        string $tablet,
        string $time,
    ): string {
        $p = &$this->packages[$id];
        if ($p['version'] !== $seenVersion) {
            return "conflict: $id already {$p['status']} " .
                "by tablet {$p['by']} at {$p['time']}";
        }
        $p =
            [
                'status' => $status,
                'version' => $p['version'] + 1,
                'by' => $tablet,
                'time' => $time,
            ] + $p;
        return 'applied';
    }

    public function registerVisitor(
        string $name,
        string $booking,
        string $tablet,
        string $time,
    ): string {
        $this->visitors[] = [
            'name' => $name,
            'booking' => $booking,
            'tablet' => $tablet,
            'time' => $time,
        ];
        return 'applied';
    }
}

final class Bookings
{
    private array $guests = [];

    public function __construct(array $parties)
    {
        foreach ($parties as $p) {
            foreach ($p['names'] as $name) {
                $this->guests[] = [
                    'name' => $name,
                    'booking' => $p['booking'],
                    'space' => $p['space'],
                ];
            }
        }
    }

    public function guests(): array
    {
        return $this->guests;
    }
}
