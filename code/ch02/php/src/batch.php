<?php
// Usage: php batch.php <batch.json>
// Simulates the batch invoice queue and compares the time to confirmation with the target.
require __DIR__ . '/batch_queue.php';

use function Morada\Batch\availableBy;
use function Morada\Batch\percentile;
use function Morada\Batch\simulate;

$number = fn(int $n) => number_format($n, 0, '.', ',');
$percent = fn(float $n) => number_format($n, 2, '.', '') . '%';

// 10 min | 1 h 36 min | never
$duration = function (int|float|null $seconds): string {
    if ($seconds === null) {
        return 'never';
    }
    $minutes = (int) round($seconds / 60);
    $h = intdiv($minutes, 60);
    if ($h === 0) {
        return "$minutes min";
    }
    return $minutes % 60 === 0 ? "$h h" : "$h h " . $minutes % 60 . ' min';
};

$p = json_decode(file_get_contents($argv[1]), true);
echo "{$p['id']}: {$p['description']} (seed {$p['seed']})\n";
echo '  assumptions: ' .
    $number($p['invoices']) .
    ' invoices in files of ' .
    $number($p['invoicesPerFile']) .
    ', ' .
    $number($p['invoicesPerSecond']) .
    " per second,\n";
echo '  return file ' .
    $duration($p['returnSeconds']) .
    ' after each file, ' .
    $p['transientFailurePercent'] .
    '% transient rejections, 1 in ' .
    $p['permanentRejectionEvery'] .
    " permanent\n";
echo '  estimate by division: ' .
    $duration($p['invoices'] / $p['invoicesPerSecond']) .
    '  target: all within ' .
    $duration($p['limitSeconds']) .
    "\n";
$failures = 0;
foreach ([false, true] as $adjusted) {
    $r = simulate($p, $adjusted);
    $within = availableBy($r, $p['limitSeconds']);
    $passed = $within === $p['invoices'];
    if (!$passed) {
        $failures++;
    }
    $pct = fn(int $m) => $duration(percentile($r, $p['invoices'], $m));
    echo $adjusted ? "adjusted:\n" : "naive:\n";
    echo "  files: {$r->files}  creation attempts: " . $number($r->attempts) . "\n";
    echo '  available at p50: ' .
        $pct(500) .
        '  p95: ' .
        $pct(950) .
        '  p99: ' .
        $pct(990) .
        '  p99.9: ' .
        $pct(999) .
        "\n";
    echo '  last available: ' .
        $duration(max(array_keys($r->availableAt))) .
        '  never created: ' .
        $number($r->notCreated) .
        '  by card: ' .
        $number($r->viaCard) .
        "\n";
    echo '  within ' .
        $duration($p['limitSeconds']) .
        ': ' .
        $number($within) .
        ' (' .
        $percent((100 * $within) / $p['invoices']) .
        ")\n";
    echo '  result: ' . ($passed ? 'PASSED' : 'FAILED') . "\n";
}
exit($failures > 0 ? 1 : 0);
