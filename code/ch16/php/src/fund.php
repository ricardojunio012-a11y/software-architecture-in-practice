<?php
// The reserve fund: the balance is the sum of the entries, and a withdrawal can only
// be recorded if there is enough balance.
namespace Morada;

use PDO;

function setUpFund(PDO $db): void
{
    $db->exec('TRUNCATE entries');
    $db->exec('INSERT INTO funds VALUES (1, 1234) ON CONFLICT DO NOTHING');
    $db->exec(
        'INSERT INTO entries (fund_id, amount_cents, description) ' .
            "VALUES (1, 100000, 'opening balance')",
    );
}

function balance(PDO $db, int $fund): int
{
    $query = $db->prepare(
        'SELECT coalesce(sum(amount_cents), 0)::int FROM entries ' .
            'WHERE fund_id = ?',
    );
    $query->execute([$fund]);
    return $query->fetchColumn();
}

function insertWithdrawal(PDO $db, int $fund, int $amount, string $description): void
{
    $db->prepare(
        'INSERT INTO entries (fund_id, amount_cents, description) ' .
            'VALUES (?, ?, ?)',
    )->execute([$fund, -$amount, $description]);
}

// The right way under READ COMMITTED: lock the fund row before reading the balance.
// Two withdrawals from the same fund then happen one after the other.
function recordWithdrawal(PDO $db, int $fund, int $amount, string $description): bool
{
    $db->beginTransaction();
    try {
        $db->prepare('SELECT id FROM funds WHERE id = ? FOR UPDATE')->execute([$fund]);
        if (balance($db, $fund) < $amount) {
            $db->rollBack();
            return false;
        }
        insertWithdrawal($db, $fund, $amount, $description);
        $db->commit();
        return true;
    } catch (\Throwable $error) {
        $db->rollBack();
        throw $error;
    }
}

// 123456 cents → "$1,234.56"; -30000 cents → "-$300.00"
function dollars(int $cents): string
{
    $sign = $cents < 0 ? '-' : '';
    return $sign . '$' . number_format(abs($cents) / 100, 2, '.', ',');
}
