<?php
// The "query" version: the delinquency query over 1 million charges, with no index,
// with an index on the wrong column, and with the right index, created by
// migration 003. The plans go to output/query; the times, which vary, go only to the
// terminal.
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/migrations.php';

use function Morada\{applyMigrations, connect, resetSchema};

$data = $argv[1];
$migrationsFolder = "$data/migrations";
$db = connect(getenv('DATABASE_URL'));
resetSchema($db);
$applied = applyMigrations($db, $migrationsFolder, 2);
$db->exec(file_get_contents("$data/input/charges.sql"));
$db->exec('ANALYZE charges');
// Without parallelism, the plan is the same on any machine and easier to read
$db->exec('SET max_parallel_workers_per_gather = 0');
$query = file_get_contents("$data/input/delinquency.sql");

// The nodes that read data (table and index scans), from the JSON plan
function scans(array $node): array
{
    $children = [];
    foreach ($node['Plans'] ?? [] as $child) {
        $children = [...$children, ...scans($child)];
    }
    if (!isset($node['Relation Name']) && !isset($node['Index Name'])) {
        return $children;
    }
    $table = isset($node['Relation Name']) ? " on {$node['Relation Name']}" : '';
    $index = isset($node['Index Name']) ? " using index {$node['Index Name']}" : '';
    $discarded = $node['Rows Removed by Filter'] ?? 0;
    $rows = "{$node['Actual Rows']} rows kept, $discarded discarded";
    return ["{$node['Node Type']}$table$index: $rows", ...$children];
}

$plans = [];
$plan = function (string $title) use ($db, $query, &$plans): void {
    $text = $db->query("EXPLAIN (ANALYZE, FORMAT JSON) $query")->fetchColumn();
    $explained = json_decode($text, true)[0];
    $plans[] = intdiv(count($plans), 3) + 1 . ". $title";
    foreach (scans($explained['Plan']) as $line) {
        $plans[] = "   $line";
    }
    $plans[] = '';
    printf("%s: %.1f ms\n", $title, $explained['Execution Time']);
};

$plan('no index');
$db->exec('CREATE INDEX charges_due_date ON charges (due_date)');
$db->exec('ANALYZE charges');
$plan('index on due date only');
$db->exec('DROP INDEX charges_due_date');
$applied = [...$applied, ...applyMigrations($db, $migrationsFolder)];
$db->exec('ANALYZE charges');
$plan('index from migration 003');

$result = [];
foreach ($db->query($query) as $r) {
    $result[] =
        "unit {$r['unit']}: open charges {$r['charges']}, " .
        "total {$r['total_cents']} cents";
}

$output = "$data/output/query";
@mkdir($output, 0777, true);
file_put_contents("$output/plans.txt", implode("\n", $plans));
file_put_contents("$output/result.txt", implode("\n", $result) . "\n");
file_put_contents("$output/migrations.txt", implode("\n", $applied) . "\n");
