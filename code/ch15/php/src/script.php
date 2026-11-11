<?php
// The "api" version: sets up the database, sends the requests in the script to the
// API (served by php -S, started by run.sh) and checks each response against
// openapi/v1.yaml.
require_once __DIR__ . '/api/api.php';
require_once __DIR__ . '/contract/validate.php';

use function Morada\Api\{connect, toJson, prepareDatabase};
use function Morada\Contract\{readContract, validateResponse};

[, $data, $url] = $argv;
$output = "$data/output/api";
$dbUrl = getenv('DATABASE_URL');
prepareDatabase($dbUrl, "$data/input/charges.json");
$contract = readContract("$data/openapi/v1.yaml");
$requests = json_decode(file_get_contents("$data/input/requests.json"), true);

function send(string $url, array $r): array
{
    $headers = ['Content-Type: application/json'];
    // Who is calling (in place of the access token) and the idempotency key
    if (isset($r['managementCompany'])) {
        $headers[] = "Morada-Management-Company: {$r['managementCompany']}";
    }
    if (isset($r['key'])) {
        $headers[] = "Idempotency-Key: {$r['key']}";
    }
    $curl = curl_init($url . $r['path']);
    curl_setopt_array($curl, [
        CURLOPT_CUSTOMREQUEST => $r['method'],
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
    ]);
    if (isset($r['body'])) {
        curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($r['body']));
    }
    $text = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $type = curl_getinfo($curl, CURLINFO_CONTENT_TYPE);
    return [$status, $type, $text];
}

$responses = [];
$discrepancies = [];
foreach ($requests as $i => $r) {
    [$status, $type, $text] = send($url, $r);
    $extras = [];
    if (isset($r['managementCompany'])) {
        $extras[] = "Morada-Management-Company: {$r['managementCompany']}";
    }
    if (isset($r['key'])) {
        $extras[] = "Idempotency-Key: {$r['key']}";
    }
    $list = $extras ? ' (' . implode(', ', $extras) . ')' : '';
    $responses[] = $i + 1 . ". {$r['description']}";
    $responses[] = "   {$r['method']} {$r['path']}$list";
    if (isset($r['body'])) {
        $responses[] = '   ' . toJson($r['body']);
    }
    $responses[] = "   → $status $type";
    $responses[] = '   ' . toJson(json_decode($text, true));
    $responses[] = '';
    $path = parse_url($r['path'], PHP_URL_PATH);
    $discrepancies = [
        ...$discrepancies,
        ...validateResponse(
            $contract,
            $r['method'],
            $path,
            $status,
            $type,
            json_decode($text),
        ),
    ];
}

$db = connect($dbUrl);
$payments = $db
    ->query('SELECT id, charge, amount_cents FROM payments ORDER BY id')
    ->fetchAll(PDO::FETCH_ASSOC);
$paid = $db
    ->query("SELECT id FROM charges WHERE status = 'paid' ORDER BY id")
    ->fetchAll(PDO::FETCH_COLUMN);
$keys = $db
    ->query(
        <<<SQL
        SELECT management_company, string_agg(key, ', ' ORDER BY key) AS list
        FROM idempotency_keys GROUP BY management_company ORDER BY management_company
        SQL
        ,
    )
    ->fetchAll(PDO::FETCH_ASSOC);
$state = ['payments recorded: ' . count($payments)];
foreach ($payments as $p) {
    $amount = $p['amount_cents'];
    $state[] = "  {$p['id']}: charge {$p['charge']}, $amount cents";
}
$state[] = 'paid charges: ' . implode(', ', $paid);
$state[] = 'stored idempotency keys:';
foreach ($keys as $k) {
    $state[] = "  {$k['management_company']}: {$k['list']}";
}
$check = [
    count($requests) . ' responses checked against openapi/v1.yaml',
    ...$discrepancies ?: ['no discrepancies'],
];

@mkdir($output, 0777, true);
file_put_contents("$output/responses.txt", implode("\n", $responses));
file_put_contents("$output/state.txt", implode("\n", $state) . "\n");
file_put_contents("$output/contract.txt", implode("\n", $check) . "\n");
echo 'api: ' .
    count($requests) .
    ' requests, ' .
    count($discrepancies) .
    " discrepancies\n";
