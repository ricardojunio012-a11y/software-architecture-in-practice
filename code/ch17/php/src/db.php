<?php
// Connection to PostgreSQL and transactions on behalf of a community or a management
// company.
namespace Morada;

use PDO;

// URL: postgresql://user:password@host:port/database
function connect(string $url): PDO
{
    $u = parse_url($url);
    $dsn = "pgsql:host={$u['host']};port={$u['port']};dbname=" . ltrim($u['path'], '/');
    return new PDO($dsn, $u['user'], $u['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
}

// Runs a function in a transaction on behalf of the requester. The "true" in
// set_config makes the value last only for this transaction: on a connection reused
// from a pool, the previous request's community is not left over for the next one.
function onBehalfOf(PDO $db, string $setting, ?int $value, callable $fn): mixed
{
    $db->beginTransaction();
    try {
        if ($value !== null) {
            $db->prepare('SELECT set_config(?, ?, true)')->execute([
                $setting,
                (string) $value,
            ]);
        }
        $result = $fn();
        $db->commit();
        return $result;
    } catch (\Throwable $error) {
        $db->rollBack();
        throw $error;
    }
}

// The board president acts on behalf of one community. The management company acts
// on behalf of every community it manages, which the database policy looks up in the
// managed_communities table.
function asCommunity(PDO $db, ?int $community, callable $fn): mixed
{
    return onBehalfOf($db, 'app.community', $community, $fn);
}

function asManagementCompany(PDO $db, int $managementCompany, callable $fn): mixed
{
    return onBehalfOf($db, 'app.management_company', $managementCompany, $fn);
}
