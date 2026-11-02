<?php
// Sprout class (Feathers): the new rule is born outside the legacy code, in a new,
// small class with its own tests. The legacy code only gains a call.
namespace Morada\Step6;

final class MonthlyLimit
{
    // Bookings per unit, per space, in the same month
    public const DEFAULT = ['party-room' => 1, 'grill-area' => 2];

    public function __construct(private readonly array $limits = self::DEFAULT) {}

    public function reached(array $request, array $approved): bool
    {
        $limit = $this->limits[$request['space']] ?? null;
        if ($limit === null) {
            return false;
        }
        $month = substr($request['date'], 0, 7);
        $made = array_filter(
            $approved,
            fn($b) => $b['unit'] === $request['unit'] &&
                $b['space'] === $request['space'] &&
                substr($b['date'], 0, 7) === $month,
        );
        return count($made) >= $limit;
    }
}
