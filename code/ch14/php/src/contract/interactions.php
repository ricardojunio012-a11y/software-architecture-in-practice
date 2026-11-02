<?php
// The interactions the consumer (the monolith) expects from the provider
// (Communications). Each one gives the state the provider must be in, the request
// and the response.
namespace Morada\Contract;

const INTERACTIONS = [
    [
        'description' => 'sending a new notice',
        'state' => 'no notice has been sent',
        'request' => [
            'method' => 'POST',
            'path' => '/notices',
            'body' => ['id' => 'E-P-001', 'text' => 'payment received'],
        ],
        'response' => [
            'status' => 200,
            'body' => ['notice' => 'E-P-001', 'status' => 'sent'],
        ],
    ],
    [
        'description' => 'resending a notice already sent',
        'state' => 'notice E-P-001 has already been sent',
        'request' => [
            'method' => 'POST',
            'path' => '/notices',
            'body' => ['id' => 'E-P-001', 'text' => 'payment received'],
        ],
        'response' => [
            'status' => 200,
            'body' => ['notice' => 'E-P-001', 'status' => 'duplicate'],
        ],
    ],
    [
        'description' => 'notice without text',
        'state' => 'no notice has been sent',
        'request' => [
            'method' => 'POST',
            'path' => '/notices',
            'body' => ['id' => 'E-P-002', 'text' => ''],
        ],
        'response' => ['status' => 400, 'body' => ['error' => 'text is required']],
    ],
];

// JSON with a two-space indent, the same as in the other languages
function json(mixed $data): string
{
    $text = json_encode(
        $data,
        JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
    );
    return preg_replace_callback(
        '/^( +)/m',
        fn($m) => str_repeat(' ', strlen($m[1]) / 2),
        $text,
    );
}
