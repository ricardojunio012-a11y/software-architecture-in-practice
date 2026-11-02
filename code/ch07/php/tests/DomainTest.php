<?php
// Tests: what the anemic model allows and what the rich model prevents.
require_once __DIR__ . '/../src/before/model.php';
require_once __DIR__ . '/../src/after/domain/schedule.php';

use Morada\Before\{Booking as AnemicBooking, Bookings};
use Morada\After\Domain\{DomainError, Money, Schedule, TimeSlot, UsagePolicy};
use PHPUnit\Framework\TestCase;

final class DomainTest extends TestCase
{
    private function policy(): UsagePolicy
    {
        return new UsagePolicy(Money::fromCents(15000), 2, 1);
    }

    public function testBeforeAnyCodeCanSaveAnOverlappingBooking(): void
    {
        foreach ([['X-1', 14, 22], ['X-2', 20, 23]] as [$id, $start, $end]) {
            $b = new AnemicBooking();
            $b->id = $id;
            $b->space = 'party-room';
            $b->date = '2026-03-14';
            $b->start = $start;
            $b->end = $end;
            Bookings::$all[] = $b;
        }
        $overlapping = array_filter(
            Bookings::$all,
            fn($b) => str_starts_with($b->id, 'X-'),
        );
        $this->assertCount(2, $overlapping); // the invalid state was accepted
    }

    public function testAfterTheScheduleRejectsAnOverlappingTimeSlot(): void
    {
        $schedule = new Schedule('party-room', $this->policy());
        $schedule->book(
            'R-1',
            'A-101',
            new TimeSlot('2026-03-14', 14, 22),
            '2026-03-02',
        );
        $this->expectException(DomainError::class);
        $this->expectExceptionMessage('time slot overlaps R-1');
        $schedule->book(
            'R-2',
            'A-202',
            new TimeSlot('2026-03-14', 20, 23),
            '2026-03-02',
        );
    }

    public function testAfterThereIsNoTimeSlotThatEndsBeforeItStarts(): void
    {
        $this->expectException(DomainError::class);
        new TimeSlot('2026-03-14', 18, 16);
    }

    public function testAfterMoneyRoundsHalfUpAndIsComparedByValue(): void
    {
        $this->assertSame('$90.01', (string) Money::fromCents(18001)->percent(50));
        $this->assertTrue(Money::fromCents(9000)->equals(Money::fromCents(9000)));
    }

    public function testAfterALastMinuteCancellationYieldsAFeeAndAnEvent(): void
    {
        $schedule = new Schedule('party-room', $this->policy());
        $schedule->book(
            'R-1',
            'A-101',
            new TimeSlot('2026-03-14', 14, 22),
            '2026-03-02',
        );
        $schedule->collectEvents();
        $this->assertSame('$90.00', (string) $schedule->cancel('R-1', '2026-03-13'));
        $types = array_map(
            fn($e) => (new ReflectionClass($e))->getShortName(),
            $schedule->collectEvents(),
        );
        $this->assertSame(['BookingCanceled'], $types);
        try {
            $schedule->cancel('R-99', '2026-03-13');
            $this->fail('should reject a booking that does not exist');
        } catch (DomainError $e) {
            $this->assertSame('booking not found', $e->getMessage());
        }
        $this->expectExceptionMessage('is not confirmed');
        $schedule->cancel('R-1', '2026-03-13');
    }
}
