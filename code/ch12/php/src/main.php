<?php
// Usage: php main.php monolith|service <output-folder>
// Sends one notice per confirmed payment: through the module, in the same process,
// or through the extracted service, over the network. Counts what happened and
// measures the time of each notice.
require_once __DIR__ . '/communications.php';

use Morada\Communications;

[, $version, $outDir] = $argv;
$notices = json_decode(file_get_contents('/data/input/load.json'), true)['notices'];
$url = getenv('COMMUNICATIONS_URL');
$count = [
    'sent' => 0,
    'calls' => 0,
    'errors' => 0,
    'retries' => 0,
    'duplicates' => 0,
    'lost' => 0,
];

function post(string $url, array $body): array
{
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => 'Content-Type: application/json',
            'content' => json_encode($body),
            'timeout' => 2,
            'ignore_errors' => true,
        ],
    ]);
    $response = @file_get_contents($url, false, $context);
    $status = isset($http_response_header[0])
        ? (int) explode(' ', $http_response_header[0])[1]
        : 0;
    return [$status, json_decode($response ?: '{}', true)];
}

// Over the network, each call can fail: try up to 3 times, always with the same id
function sendOverNetwork(string $url, string $id, string $text, array &$count): void
{
    for ($attempt = 1; $attempt <= 3; $attempt++) {
        if ($attempt > 1) {
            $count['retries']++;
            // Growing backoff (5 to 10 ms, then 10 to 20 ms), with jitter, so that
            // clients that failed together do not all come back at the same instant
            $cap = 10 * 2 ** ($attempt - 2);
            usleep(
                (int) (($cap / 2 + (mt_rand() / mt_getrandmax()) * ($cap / 2)) * 1000),
            );
        }
        $count['calls']++;
        [$status, $body] = post("$url/notices", ['id' => $id, 'text' => $text]);
        if ($status === 200) {
            if ($body['status'] === 'duplicate') {
                $count['duplicates']++;
            }
            $count['sent']++;
            return;
        }
        $count['errors']++;
    }
    $count['lost']++;
}

$communications = new Communications();
if ($version === 'service') {
    post("$url/reset", []);
}
$times = [];
$start = hrtime(true);
for ($i = 1; $i <= $notices; $i++) {
    $id = sprintf('E-P-%03d', $i);
    $text = 'payment ' . substr($id, 2) . ' received';
    $t0 = hrtime(true);
    if ($version === 'service') {
        sendOverNetwork($url, $id, $text, $count);
    } elseif ($communications->send($id, $text)) {
        $count['sent']++;
    }
    $times[] = (hrtime(true) - $t0) / 1e6;
}
$total = (hrtime(true) - $start) / 1e6;

$sorted = $times;
sort($sorted);
$ms = fn($v) => sprintf('%.3f ms', $v);
@mkdir("$outDir/$version", 0777, true);
file_put_contents(
    "$outDir/$version/result.txt",
    implode("\n", [
        "notices sent: {$count['sent']}",
        "network calls: {$count['calls']}",
        "error responses: {$count['errors']}",
        "retries: {$count['retries']}",
        "duplicate notices ignored: {$count['duplicates']}",
        "notices lost: {$count['lost']}",
    ]) . "\n",
);
// Times vary from machine to machine: they stay out of the verified folder
file_put_contents(
    "$outDir/times-$version.txt",
    implode("\n", [
        'mean time per notice: ' . $ms(array_sum($times) / count($times)),
        'p95 per notice: ' . $ms($sorted[(int) floor(count($sorted) * 0.95)]),
        'worst notice: ' . $ms(end($sorted)),
        'total time: ' . $ms($total),
    ]) . "\n",
);
echo "$version: {$count['sent']} notices; output in $outDir/$version\n";
