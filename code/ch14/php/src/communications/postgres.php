<?php
// Notice repository in PostgreSQL. The primary key guarantees, in the database,
// that the same notice is not saved twice.
namespace Morada\Communications;

require_once __DIR__ . '/domain.php';

use PDO;

final class PostgresNotices implements NoticeRepository
{
    public function __construct(private readonly PDO $db) {}

    public static function connect(string $url, bool $recreate = true): self
    {
        $u = parse_url($url);
        $db = new PDO(
            "pgsql:host={$u['host']};port={$u['port']};dbname=" .
                ltrim($u['path'], '/'),
            $u['user'],
            $u['pass'],
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION],
        );
        if ($recreate) {
            $db->exec('DROP TABLE IF EXISTS notices');
            $db->exec('CREATE TABLE notices (id text PRIMARY KEY, text text NOT NULL)');
        }
        return new self($db);
    }

    public function alreadySent(string $id): bool
    {
        $query = $this->db->prepare('SELECT 1 FROM notices WHERE id = ?');
        $query->execute([$id]);
        return $query->fetchColumn() !== false;
    }

    public function record(string $id, string $text): void
    {
        $this->db->prepare('INSERT INTO notices VALUES (?, ?)')->execute([$id, $text]);
    }
}
