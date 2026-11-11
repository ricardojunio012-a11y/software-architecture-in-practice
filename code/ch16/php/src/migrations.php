<?php
// Versioned migrations: each file in migrations/ runs only once, in order, and is
// recorded in the applied_migrations table. A file that starts with
// "-- no transaction" runs outside a transaction (CREATE INDEX CONCURRENTLY needs it).
namespace Morada;

use PDO;

function applyMigrations(PDO $db, string $folder, float $upTo = INF): array
{
    $db->exec(
        <<<SQL
        CREATE TABLE IF NOT EXISTS applied_migrations (
          version text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
        SQL
        ,
    );
    $done = $db
        ->query('SELECT version FROM applied_migrations')
        ->fetchAll(PDO::FETCH_COLUMN);
    $record = $db->prepare('INSERT INTO applied_migrations (version) VALUES (?)');
    $files = array_map('basename', glob("$folder/*.sql"));
    sort($files);
    $applied = [];
    foreach ($files as $file) {
        if ((int) $file > $upTo) {
            break;
        }
        if (in_array($file, $done, true)) {
            continue;
        }
        $sql = file_get_contents("$folder/$file");
        if (str_starts_with($sql, '-- no transaction')) {
            $db->exec($sql);
            $record->execute([$file]);
        } else {
            // The migration and its record go in together, or neither does
            $db->beginTransaction();
            try {
                $db->exec($sql);
                $record->execute([$file]);
                $db->commit();
            } catch (\Throwable $error) {
                $db->rollBack();
                throw $error;
            }
        }
        $applied[] = $file;
    }
    return $applied;
}
