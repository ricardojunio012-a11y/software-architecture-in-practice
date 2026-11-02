<?php
// Tests: the core with no real adapter, the adapters with no real core, and the
// same contract checked against both repositories.
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../src/application/booking-service.php';
require_once __DIR__ . '/../src/adapters/outbound/in-memory.php';
require_once __DIR__ . '/../src/adapters/outbound/postgres.php';
require_once __DIR__ . '/../src/adapters/inbound/cli.php';

use Morada\Adapters\Outbound\{InMemorySchedules, PostgresSchedules};
use Morada\Application\{BookingService, BookingUseCases, ScheduleRepository};
use Morada\Domain\{NotFoundError, RuleViolatedError, Space};
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

use function Morada\Adapters\Inbound\execute;

final class HexagonalTest extends TestCase
{
    private static function partyRoom(): Space
    {
        return new Space('party-room', 15000, 2);
    }

    private const REQUEST = [
        'booking' => 'R-1',
        'unit' => 'A-101',
        'space' => 'party-room',
        'date' => '2026-03-14',
        'start' => 14,
        'end' => 22,
        'requestedOn' => '2026-03-02',
    ];

    public function testTheCoreBooksAndRejectsAnOverlapWithOnlyMemory(): void
    {
        $service = new BookingService(new InMemorySchedules([self::partyRoom()]));
        $this->assertSame('$180.00', $service->book(self::REQUEST)['fee']);
        $this->expectException(RuleViolatedError::class);
        $service->book(['booking' => 'R-2'] + self::REQUEST);
    }

    public function testTheCommandLineAdapterDoesNotNeedTheRealCore(): void
    {
        $fake = new class implements BookingUseCases {
            public array $calls = [];

            public function listSpaces(): array
            {
                return [];
            }

            public function book(array $request): array
            {
                return [];
            }

            public function cancel(string $booking, string $requestedOn): array
            {
                $this->calls[] = "$booking $requestedOn";
                return ['booking' => $booking, 'cancellationFee' => '$0.00'];
            }

            public function bookingsForSpace(string $space): array
            {
                return [];
            }
        };
        $result = execute($fake, ['cancel', 'R-7', '2026-03-01']);
        $this->assertSame(['R-7 2026-03-01'], $fake->calls);
        $this->assertSame(['R-7 canceled, cancellation fee $0.00', 0], $result);
    }

    public static function repositories(): array
    {
        $cases = ['in memory' => [fn() => new InMemorySchedules([self::partyRoom()])]];
        // In the container, the database exists; outside it, the PostgreSQL case is left out
        if (getenv('DATABASE_URL')) {
            $cases['PostgreSQL'] = [
                function () {
                    $u = parse_url(getenv('DATABASE_URL'));
                    $db = new PDO(
                        "pgsql:host={$u['host']};port={$u['port']};dbname=" .
                            ltrim($u['path'], '/'),
                        $u['user'],
                        $u['pass'],
                        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION],
                    );
                    $schedules = new PostgresSchedules($db, [self::partyRoom()]);
                    $schedules->prepare();
                    return $schedules;
                },
            ];
        }
        return $cases;
    }

    // The same contract holds for any adapter of the outbound port
    #[DataProvider('repositories')]
    public function testContractKeepsTheScheduleAndFindsItByBooking(
        callable $create,
    ): void {
        /** @var ScheduleRepository $schedules */
        $schedules = $create();
        $schedule = $schedules->forSpace('party-room');
        $schedule->book('R-1', 'A-101', '2026-03-14', 14, 22, '2026-03-02');
        $schedules->save($schedule);
        $ids = array_map(fn($b) => $b->id, $schedules->forBooking('R-1')->bookings());
        $this->assertSame(['R-1'], $ids);
    }

    #[DataProvider('repositories')]
    public function testContractReportsWhenTheBookingDoesNotExist(
        callable $create,
    ): void {
        $this->expectException(NotFoundError::class);
        $create()->forBooking('R-9');
    }
}
