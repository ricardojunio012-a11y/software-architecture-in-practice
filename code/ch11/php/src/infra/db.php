<?php
// The Billing database: the payments and, in the outbox version, the table of events
// to publish, saved in the same transaction as the payment.
namespace Morada\Infra;

use PDO;

function connectDb(): PDO
{
    // DATABASE_URL: postgresql://user:password@host:port/database
    $u = parse_url(getenv('DATABASE_URL'));
    $db = new PDO(
        "pgsql:host={$u['host']};port={$u['port']};dbname=" . ltrim($u['path'], '/'),
        $u['user'],
        $u['pass'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION],
    );
    $db->exec('DROP TABLE IF EXISTS outbox, payments');
    $db->exec(
        'CREATE TABLE payments (
            id text PRIMARY KEY, unit text, booking text, amount_cents integer)',
    );
    $db->exec(
        'CREATE TABLE outbox (
            id serial PRIMARY KEY, event text UNIQUE, payload text,
            published boolean NOT NULL DEFAULT false)',
    );
    return $db;
}

function savePayment(PDO $db, array $p): void
{
    $db->prepare('INSERT INTO payments VALUES (?, ?, ?, ?)')->execute([
        $p['payment'],
        $p['unit'],
        $p['booking'],
        $p['amountCents'],
    ]);
}

// Payment and event in the same transaction: either both are saved, or neither is
function saveWithOutbox(PDO $db, array $p, array $e): void
{
    $db->beginTransaction();
    try {
        savePayment($db, $p);
        $db->prepare('INSERT INTO outbox (event, payload) VALUES (?, ?)')->execute([
            $e['event'],
            json_encode($e, JSON_UNESCAPED_UNICODE),
        ]);
        $db->commit();
    } catch (\Throwable $error) {
        // Without the rollBack, the connection would be stuck in an open transaction
        $db->rollBack();
        throw $error;
    }
}
