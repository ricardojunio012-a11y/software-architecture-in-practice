<?php
// The Communications service: the same module, now behind an HTTP API, in its own
// process and container. With FAILURES=yes, it fails on purpose: every 25th call
// it rejects the request, and every 40th call it sends the notice but "loses" the
// response. PHP's built-in server handles each request from scratch, so the
// service keeps its state in a file.
require_once __DIR__ . '/communications.php';

use Morada\Communications;

const STATE = '/tmp/communications.json';

function reply(int $status, array $body): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($body);
}

$method = $_SERVER['REQUEST_METHOD'];
$route = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($method === 'GET' && $route === '/health') {
    reply(200, []);
    return;
}
// Lab only: start each run from scratch
if ($method === 'POST' && $route === '/reset') {
    file_put_contents(STATE, json_encode(['calls' => 0, 'sent' => []]));
    reply(200, []);
    return;
}
if ($method !== 'POST' || $route !== '/notices') {
    reply(404, ['error' => 'not found']);
    return;
}

$notice = json_decode(file_get_contents('php://input'), true);
$state = json_decode(@file_get_contents(STATE) ?: '{"calls":0,"sent":{}}', true);
$fail = getenv('FAILURES') === 'yes';
$state['calls']++;
$communications = new Communications((array) $state['sent']);
if ($fail && $state['calls'] % 25 === 0) {
    $result = [503, ['error' => 'unavailable']];
} else {
    $sent = $communications->send($notice['id'], $notice['text']);
    $result =
        $fail && $state['calls'] % 40 === 0
            ? [503, ['error' => 'timed out']]
            : [
                200,
                ['notice' => $notice['id'], 'status' => $sent ? 'sent' : 'duplicate'],
            ];
}
$state['sent'] = $communications->sent();
file_put_contents(STATE, json_encode($state));
reply(...$result);
