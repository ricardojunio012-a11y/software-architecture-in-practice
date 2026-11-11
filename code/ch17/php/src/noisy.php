<?php
// The "noisy" version: a server handles one request at a time, in order of arrival,
// and each request takes serviceMs. With no limit, one community's burst fills the
// queue and delays everyone. With a token bucket per community, the burst is
// rejected (429) and the others barely wait. Time is simulated, and the result is
// always the same.
require_once __DIR__ . '/bucket.php';

use Morada\TokenBucket;

$data = $argv[1];
$scenario = json_decode(file_get_contents("$data/input/noisy.json"), true);

$requests = [];
foreach ($scenario['clients'] as $c) {
    for ($t = $c['startMs']; $t < $scenario['durationMs']; $t += $c['intervalMs']) {
        $requests[] = [$t, $c['community']];
    }
}
sort($requests);

function simulate(array $requests, int $serviceMs, ?array $limit): array
{
    $rejected = [];
    $waits = [];
    $buckets = [];
    $freeAt = 0;
    foreach ($requests as [$t, $community]) {
        $rejected[$community] ??= 0;
        $waits[$community] ??= [];
        if ($limit) {
            $buckets[$community] ??= new TokenBucket(
                $limit['burst'],
                $limit['perSecond'],
            );
            if (!$buckets[$community]->allows($t)) {
                $rejected[$community]++;
                continue;
            }
        }
        // The request waits for the server to finish what arrived before it
        $start = max($t, $freeAt);
        $waits[$community][] = $start - $t;
        $freeAt = $start + $serviceMs;
    }
    ksort($waits);
    $lines = [];
    foreach ($waits as $community => $list) {
        $average = $list ? intdiv(array_sum($list), count($list)) : 0;
        $max = $list ? max($list) : 0;
        $total = count($list) + $rejected[$community];
        $lines[] =
            "community $community: $total requests, " .
            count($list) .
            " served, {$rejected[$community]} rejected, " .
            "average wait $average ms, max $max ms";
    }
    return $lines;
}

$limit = $scenario['limit'];
$result = [
    '== no limit',
    ...simulate($requests, $scenario['serviceMs'], null),
    '',
    "== with a per-community limit (burst of {$limit['burst']}, " .
    "{$limit['perSecond']} per second)",
    ...simulate($requests, $scenario['serviceMs'], $limit),
];

$output = "$data/output/noisy";
@mkdir($output, 0777, true);
file_put_contents("$output/result.txt", implode("\n", $result) . "\n");
echo 'noisy: ' . count($requests) . " requests simulated\n";
