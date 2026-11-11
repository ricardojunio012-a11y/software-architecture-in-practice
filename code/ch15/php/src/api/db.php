<?php
// The API's database: communities, charges, payments and idempotency keys. The
// primary key of the keys table, (management_company, key), guarantees a single
// processing per key of each client, even with simultaneous requests.
namespace Morada\Api;

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

function prepareDatabase(string $url, string $chargesFile): void
{
    $db = connect($url);
    $db->exec(
        <<<SQL
        DROP TABLE IF EXISTS idempotency_keys, payments, charges, communities;
        DROP SEQUENCE IF EXISTS payments_seq;
        CREATE TABLE communities (id text PRIMARY KEY, management_company text NOT NULL);
        CREATE TABLE charges (
          id text PRIMARY KEY,
          community text NOT NULL REFERENCES communities,
          unit text NOT NULL,
          due_date date NOT NULL,
          amount_cents integer NOT NULL,
          status text NOT NULL
        );
        CREATE TABLE payments (
          id text PRIMARY KEY,
          charge text NOT NULL UNIQUE REFERENCES charges,
          amount_cents integer NOT NULL
        );
        CREATE SEQUENCE payments_seq;
        CREATE TABLE idempotency_keys (
          management_company text,
          key text,
          request text NOT NULL,
          status integer,
          response text,
          PRIMARY KEY (management_company, key)
        )
        SQL
        ,
    );
    // Who manages each community is in communities.json, next to the charges
    $folder = dirname($chargesFile);
    $community = $db->prepare('INSERT INTO communities VALUES (?, ?)');
    foreach (json_decode(file_get_contents("$folder/communities.json"), true) as $c) {
        $community->execute([$c['id'], $c['managementCompany']]);
    }
    $charge = $db->prepare('INSERT INTO charges VALUES (?, ?, ?, ?, ?, ?)');
    foreach (json_decode(file_get_contents($chargesFile), true) as $c) {
        $charge->execute([
            $c['id'],
            $c['community'],
            $c['unit'],
            $c['dueDate'],
            $c['amountCents'],
            $c['status'],
        ]);
    }
}
