<?php
// The "isolation" version: two reserve fund withdrawals, always interleaved in the
// same order, under three isolation levels. Each transaction checks the balance
// before recording its withdrawal, and even so the balance can go negative.
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/fund.php';
require_once __DIR__ . '/migrations.php';

use function Morada\{
    applyMigrations,
    balance,
    connect,
    dollars,
    insertWithdrawal,
    resetSchema,
    setUpFund,
};

const SERIALIZATION_FAILURE = '40001';

$data = $argv[1];
$url = getenv('DATABASE_URL');
$db = connect($url);
resetSchema($db);
applyMigrations($db, "$data/migrations");

$log = [];

// A whole withdrawal, with no interleaving: used on the retry
function retry(PDO $t, string $level, int $amount, string $reason, array &$log): void
{
    $t->exec("BEGIN ISOLATION LEVEL $level");
    $read = balance($t, 1);
    $log[] = 'T2 reads the balance: ' . dollars($read);
    if ($read < $amount) {
        $log[] =
            'T2 refuses the withdrawal of ' .
            dollars($amount) .
            ': insufficient balance';
        $t->exec('ROLLBACK');
        return;
    }
    insertWithdrawal($t, 1, $amount, $reason);
    $t->exec('COMMIT');
    $log[] = 'T2 records a withdrawal of ' . dollars($amount) . ' and commits';
}

foreach (['READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE'] as $level) {
    $log[] = "== $level";
    setUpFund($db);
    $t1 = connect($url);
    $t2 = connect($url);
    $t1->exec("BEGIN ISOLATION LEVEL $level");
    $t2->exec("BEGIN ISOLATION LEVEL $level");
    $log[] = 'T1 and T2 begin';
    $read1 = balance($t1, 1);
    $log[] = 'T1 reads the balance: ' . dollars($read1);
    $read2 = balance($t2, 1);
    $log[] = 'T2 reads the balance: ' . dollars($read2);
    if ($read1 >= 70000) {
        insertWithdrawal($t1, 1, 70000, 'gate repair');
        $log[] = 'T1 records a withdrawal of ' . dollars(70000);
    }
    if ($read2 >= 60000) {
        insertWithdrawal($t2, 1, 60000, 'facade painting');
        $log[] = 'T2 records a withdrawal of ' . dollars(60000);
    }
    $t1->exec('COMMIT');
    $log[] = 'T1 commits';
    try {
        $t2->exec('COMMIT');
        $log[] = 'T2 commits';
    } catch (PDOException $error) {
        if ($error->getCode() !== SERIALIZATION_FAILURE) {
            throw $error;
        }
        $log[] = 'T2 cannot commit: serialization failure; it tries again';
        $t2->exec('ROLLBACK');
        retry($t2, $level, 60000, 'facade painting', $log);
    }
    $t1 = $t2 = null;
    $final = balance($db, 1);
    $warning = $final < 0 ? ' (negative: the rule was broken)' : '';
    $log[] = 'final balance: ' . dollars($final) . $warning;
    $log[] = '';
}

$output = "$data/output/isolation";
@mkdir($output, 0777, true);
file_put_contents("$output/run.txt", implode("\n", $log));
echo "isolation: three levels run\n";
