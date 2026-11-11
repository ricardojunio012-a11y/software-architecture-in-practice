<?php
// HTTP entry point of the API, served by PHP's built-in server (php -S). Each
// request runs in a separate process, with its own database connection.
require_once __DIR__ . '/../src/api/api.php';

use function Morada\Api\{handle, connect, toJson};

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
[$status, $body] = handle(
    connect(getenv('DATABASE_URL')),
    $_SERVER['REQUEST_METHOD'],
    $path,
    $_GET,
    $_SERVER['HTTP_MORADA_MANAGEMENT_COMPANY'] ?? null,
    $_SERVER['HTTP_IDEMPOTENCY_KEY'] ?? null,
    file_get_contents('php://input'),
);
http_response_code($status);
$type = $status >= 400 ? 'application/problem+json' : 'application/json';
header("Content-Type: $type");
// The 401 tells the client how to authenticate (RFC 9110)
if ($status === 401) {
    header('WWW-Authenticate: Bearer');
}
echo toJson($body);
