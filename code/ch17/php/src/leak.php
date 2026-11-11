<?php
// The "leak" version: the board president of community 12 opens the delinquency
// report, first without RLS and then with RLS. Then management company 3, which
// manages communities 12 and 15, opens the same report. The faulty query is the same
// in every case.
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/report.php';

use function Morada\{asCommunity, asManagementCompany, connect, delinquents};

const BOARD_PRESIDENT = 12;
const MANAGEMENT_COMPANY = 3; // manages communities 12 and 15
const REJECTED_BY_POLICY = '42501';

$data = $argv[1];
$sql = fn(string $file) => file_get_contents("$data/sql/$file");
$admin = connect(getenv('DATABASE_URL'));
$admin->exec($sql('schema.sql'));
$app = connect(getenv('APP_DATABASE_URL'));

$log = [];

function dollars(int $cents): string
{
    return '$' . number_format($cents / 100, 2);
}

function show(
    int $step,
    string $title,
    array $rows,
    array &$log,
    array $allowed = [BOARD_PRESIDENT],
): void {
    $log[] = "$step. $title";
    $leaked = 0;
    foreach ($rows as $r) {
        $isAllowed = in_array($r['community_id'], $allowed, true);
        $warning = $isAllowed ? '' : '  <- another community';
        $leaked += $isAllowed ? 0 : 1;
        $log[] =
            "   community {$r['community_id']} | unit {$r['unit']} | " .
            "{$r['resident']} | " .
            dollars($r['amount_cents']) .
            $warning;
    }
    if (!$rows) {
        $log[] = '   no rows';
    }
    $log[] = "   rows from other communities: $leaked";
    $log[] = '';
}

$report = fn() => delinquents($app);
show(
    1,
    "board president's report for community 12, without RLS",
    asCommunity($app, BOARD_PRESIDENT, $report),
    $log,
);
$admin->exec($sql('rls.sql'));
show(2, 'the same report, with RLS', asCommunity($app, BOARD_PRESIDENT, $report), $log);
show(
    3,
    'with RLS, in a transaction with no community set',
    asCommunity($app, null, $report),
    $log,
);

$log[] = '4. with RLS, community 12 tries to write a charge for community 15';
try {
    asCommunity(
        $app,
        BOARD_PRESIDENT,
        fn() => $app->exec(
            'INSERT INTO charges (community_id, unit, resident, amount_cents, status) ' .
                "VALUES (15, '13', 'Hugh Davis', 38000, 'open')",
        ),
    );
    $log[] = '   written';
} catch (PDOException $error) {
    if ($error->getCode() !== REJECTED_BY_POLICY) {
        throw $error;
    }
    $log[] = '   rejected by the database: the row fails the RLS policy';
}

show(
    5,
    'with RLS, management company 3, which manages communities 12 and 15',
    asManagementCompany($app, MANAGEMENT_COMPANY, $report),
    $log,
    [12, 15],
);
$log[] = '6. with RLS, management company 3 tries to write a charge for community 20';
try {
    asManagementCompany(
        $app,
        MANAGEMENT_COMPANY,
        fn() => $app->exec(
            'INSERT INTO charges (community_id, unit, resident, amount_cents, status) ' .
                "VALUES (20, 'A-5', 'Hugh Davis', 61000, 'open')",
        ),
    );
    $log[] = '   written';
} catch (PDOException $error) {
    if ($error->getCode() !== REJECTED_BY_POLICY) {
        throw $error;
    }
    $log[] = '   rejected by the database: the row fails every policy';
}

$output = "$data/output/leak";
@mkdir($output, 0777, true);
file_put_contents("$output/report.txt", implode("\n", $log) . "\n");
echo "leak: six steps run\n";
