<?php
// Usage: php main.php <scenarios.json>
// Runs each scenario, prints the report and exits with an error if any of them fails.
require __DIR__ . '/scenarios.php';

use function Morada\run;

$number = fn(float $n) => number_format(round($n), 0, '.', ',');
$decimal = fn(float $n, int $places) => number_format($n, $places, '.', '');

// 2.25 s | 4 min | 6 h 40 min
$duration = function (float $seconds) use ($decimal): string {
    if ($seconds < 60) {
        return $decimal($seconds, 2) . ' s';
    }
    $minutes = (int) round($seconds / 60);
    $h = intdiv($minutes, 60);
    if ($h === 0) {
        return "$minutes min";
    }
    return $minutes % 60 === 0 ? "$h h" : "$h h " . $minutes % 60 . ' min';
};

$scenarios = json_decode(file_get_contents($argv[1]), true);
$today = new DateTimeImmutable('2026-03-02', new DateTimeZone('UTC'));
$failures = 0;

foreach ($scenarios as $s) {
    $r = run($s, $today);
    if (!$r->passed) {
        $failures++;
    }
    $throughput = $r->charges / $r->calculationSeconds;
    echo "{$s['id']}: {$s['description']}\n";
    echo '  charges: ' .
        $number($r->charges) .
        '  target: within ' .
        $duration($s['limitSeconds']) .
        "\n";
    echo '  calculation (measured): ' .
        $duration($r->calculationSeconds) .
        ', ' .
        $number($throughput) .
        " per second\n";
    echo "  invoices at the processor (estimated, {$s['invoicesPerSecond']}/s): " .
        $duration($r->processorSeconds) .
        "\n";
    echo '  notices: ' .
        $decimal($r->noticeBytes / 1e6, 1) .
        ' MB, ' .
        $number($r->noticeBytes / $r->charges) .
        " bytes per notice\n";
    echo '  result: ' . ($r->passed ? 'PASSED' : 'FAILED') . "\n";
}
echo count($scenarios) -
    $failures .
    ' of ' .
    count($scenarios) .
    " scenarios within target.\n";
exit($failures > 0 ? 1 : 0);
