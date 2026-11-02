<?php
// The HTTP layer of the Communications service: the provider of the contract. The
// handle function takes the request and returns status and body; server.php wires
// it to HTTP.
namespace Morada\Communications;

require_once __DIR__ . '/domain.php';

function handle(
    Communications $communications,
    string $method,
    string $path,
    string $body,
): array {
    if ($method !== 'POST' || $path !== '/notices') {
        return [404, ['error' => 'not found']];
    }
    $notice = json_decode($body, true);
    try {
        $status = $communications->send($notice['id'], $notice['text']);
        return [200, ['notice' => $notice['id'], 'status' => $status]];
    } catch (InvalidDataError $error) {
        return [400, ['error' => $error->getMessage()]];
    }
}

// Starts a PHP HTTP server with the given router and waits for the port to open
function start(string $router, int $port, array $environment = []): mixed
{
    $process = proc_open(
        ['php', '-S', "127.0.0.1:$port", $router],
        [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']],
        $pipes,
        null,
        $environment + getenv(),
    );
    for ($i = 0; $i < 100 && !@fsockopen('127.0.0.1', $port); $i++) {
        usleep(50000);
    }
    return $process;
}
