<?php
// Tests: the subscribers are idempotent and independent of each other.
require_once __DIR__ . '/../src/events.php';
require_once __DIR__ . '/../src/modules/bookings.php';
require_once __DIR__ . '/../src/modules/communications.php';

use Morada\Modules\{Communications, Bookings};
use PHPUnit\Framework\TestCase;

use function Morada\eventFor;

final class EventsTest extends TestCase
{
    private static function event(): array
    {
        return eventFor([
            'payment' => 'P-1',
            'unit' => 'A-1',
            'booking' => 'R-1',
            'amountCents' => 18000,
        ]);
    }

    public function testConfirmTheBookingAndNotifyTheResident(): void
    {
        $bookings = new Bookings([
            [
                'booking' => 'R-1',
                'unit' => 'A-1',
                'space' => 'party-room',
                'date' => '2026-03-14',
            ],
        ]);
        $communications = new Communications();
        $bookings->onPaymentConfirmed(self::event());
        $communications->onPaymentConfirmed(self::event());
        $this->assertSame(
            ['R-1;A-1;party-room;2026-03-14;confirmed'],
            $bookings->lines(),
        );
        $this->assertCount(1, $communications->notices);
    }

    public function testIgnoreTheSameEventDeliveredTwice(): void
    {
        $communications = new Communications();
        $communications->onPaymentConfirmed(self::event());
        $communications->onPaymentConfirmed(self::event());
        $this->assertCount(1, $communications->notices);
        $this->assertSame(
            'communications ignored E-P-1 (duplicate)',
            $communications->log[1],
        );
    }
}
