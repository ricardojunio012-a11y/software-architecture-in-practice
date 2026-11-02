<?php
// Composition root: the only place that picks the adapters and wires them to the core.
require_once __DIR__ . '/../../vendor/autoload.php';
require_once __DIR__ . '/../application/booking-service.php';
require_once __DIR__ . '/../adapters/outbound/in-memory.php';
require_once __DIR__ . '/../adapters/outbound/postgres.php';

use Morada\Adapters\Outbound\{InMemorySchedules, PostgresSchedules};
use Morada\Application\BookingService;
use Morada\Domain\Space;

function assemble(string $repository, bool $prepare = false): array
{
    $data = json_decode(file_get_contents('/data/input/spaces.json'), true);
    $spaces = array_map(
        fn($s) => new Space($s['id'], $s['feeCents'], $s['minNoticeDays']),
        $data['spaces'],
    );
    if ($repository === 'memory') {
        $schedules = new InMemorySchedules($spaces);
        return [new BookingService($schedules), $schedules];
    }
    // DATABASE_URL: postgresql://user:password@host:port/database
    $u = parse_url(getenv('DATABASE_URL'));
    $db = new PDO(
        "pgsql:host={$u['host']};port={$u['port']};dbname=" . ltrim($u['path'], '/'),
        $u['user'],
        $u['pass'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION],
    );
    $schedules = new PostgresSchedules($db, $spaces);
    if ($prepare) {
        $schedules->prepare();
    }
    return [new BookingService($schedules), $schedules];
}
