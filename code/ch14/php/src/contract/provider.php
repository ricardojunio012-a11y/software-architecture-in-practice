<?php
// Provider-side contract verification. Reads the contract the consumer published,
// sets up the state each interaction asks for, hands the request to the real HTTP
// layer of Communications and compares the response with the agreed one.
require_once __DIR__ . '/../communications/api.php';

use Morada\Communications\{Communications, InMemoryNotices};

use function Morada\Communications\handle;

$outDir = $argv[1];
$contract = json_decode(file_get_contents("$outDir/consumer/contract.json"), true);

// Each state in the contract has a setup on the provider side
$states = [
    'no notice has been sent' => fn($c) => null,
    'notice E-P-001 has already been sent' => fn($c) => $c->send(
        'E-P-001',
        'payment received',
    ),
];

// The response satisfies the contract if it has the agreed status and the fields
// the consumer declared. Extra fields break no one.
function satisfies(array $actual, array $expected): bool
{
    if ($actual['status'] !== $expected['status']) {
        return false;
    }
    foreach ($expected['body'] as $field => $value) {
        if (($actual['body'][$field] ?? null) !== $value) {
            return false;
        }
    }
    return true;
}

$report = [];
foreach ($contract['interactions'] as $interaction) {
    $communications = new Communications(new InMemoryNotices());
    $states[$interaction['state']]($communications);
    $request = $interaction['request'];
    [$status, $body] = handle(
        $communications,
        $request['method'],
        $request['path'],
        json_encode($request['body']),
    );
    $actual = ['status' => $status, 'body' => $body];
    $ok = satisfies($actual, $interaction['response']);
    $report[] = $ok
        ? "{$interaction['description']}: verified"
        : "{$interaction['description']}: FAILED (expected " .
            json_encode($interaction['response'], JSON_UNESCAPED_UNICODE) .
            ', received ' .
            json_encode($actual, JSON_UNESCAPED_UNICODE) .
            ')';
}

@mkdir("$outDir/provider", 0777, true);
file_put_contents("$outDir/provider/report.txt", implode("\n", $report) . "\n");
echo 'provider: ' . count($report) . " interactions verified\n";
exit(str_contains(implode($report), 'FAILED') ? 1 : 0);
