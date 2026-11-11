<?php
// Connection to PostgreSQL and a clean schema for each experiment.
namespace Morada;

use PDO;

// DATABASE_URL: postgresql://user:password@host:port/database
function connect(string $url): PDO
{
    $u = parse_url($url);
    $dsn = "pgsql:host={$u['host']};port={$u['port']};dbname=" . ltrim($u['path'], '/');
    return new PDO($dsn, $u['user'], $u['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
}

function resetSchema(PDO $db): void
{
    $db->exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
}
