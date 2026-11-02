<?php
// PostgreSQL outbound adapter: it fulfills the same port, keeping the bookings in a
// table. It is the only file that knows SQL and the database driver.
namespace Morada\Adapters\Outbound;

require_once __DIR__ . '/../../application/ports.php';

use Morada\Application\ScheduleRepository;
use Morada\Domain\{Booking, NotFoundError, Schedule, Space};
use PDO;

final class PostgresSchedules implements ScheduleRepository
{
    /** @var array<string, Space> */
    private array $spaces = [];

    public function __construct(private readonly PDO $db, array $spaces)
    {
        foreach ($spaces as $s) {
            $this->spaces[$s->id] = $s;
        }
    }

    // Drops and recreates the table: the lab always starts from scratch
    public function prepare(): void
    {
        $this->db->exec('DROP TABLE IF EXISTS bookings');
        $this->db->exec(
            'CREATE TABLE bookings (
                id text PRIMARY KEY,
                space text NOT NULL,
                unit text NOT NULL,
                date text NOT NULL,
                start_hour integer NOT NULL,
                end_hour integer NOT NULL,
                fee_cents integer NOT NULL
            )',
        );
    }

    public function all(): array
    {
        return array_map(fn($id) => $this->forSpace($id), array_keys($this->spaces));
    }

    public function forSpace(string $space): Schedule
    {
        $s = $this->spaces[$space] ?? throw new NotFoundError('space not found');
        $query = $this->db->prepare(
            'SELECT id, unit, date, start_hour, end_hour, fee_cents FROM bookings
             WHERE space = ? ORDER BY date, start_hour',
        );
        $query->execute([$space]);
        $bookings = array_map(
            fn($r) => new Booking(
                $r['id'],
                $r['unit'],
                $r['date'],
                $r['start_hour'],
                $r['end_hour'],
                $r['fee_cents'],
            ),
            $query->fetchAll(PDO::FETCH_ASSOC),
        );
        return new Schedule($s, $bookings);
    }

    public function forBooking(string $booking): Schedule
    {
        $query = $this->db->prepare('SELECT space FROM bookings WHERE id = ?');
        $query->execute([$booking]);
        $space = $query->fetchColumn();
        if ($space === false) {
            throw new NotFoundError('booking not found');
        }
        return $this->forSpace($space);
    }

    // Writes the schedule in one transaction: the aggregate is the unit of consistency
    public function save(Schedule $schedule): void
    {
        $this->db->beginTransaction();
        try {
            $this->db
                ->prepare('DELETE FROM bookings WHERE space = ?')
                ->execute([$schedule->space->id]);
            $insert = $this->db->prepare(
                'INSERT INTO bookings VALUES (?, ?, ?, ?, ?, ?, ?)',
            );
            foreach ($schedule->bookings() as $b) {
                $insert->execute([
                    $b->id,
                    $schedule->space->id,
                    $b->unit,
                    $b->date,
                    $b->start,
                    $b->end,
                    $b->feeCents,
                ]);
            }
            $this->db->commit();
        } catch (\Throwable $error) {
            $this->db->rollBack();
            throw $error;
        }
    }
}
