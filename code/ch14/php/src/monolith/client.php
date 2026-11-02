<?php
// The client the monolith uses to talk to the Communications service: the
// consumer of the contract. It interprets the responses the service promises.
namespace Morada\Monolith;

final class CommunicationsClient
{
    public function __construct(private readonly string $url) {}

    public function send(string $id, string $text): array
    {
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => 'Content-Type: application/json',
                'content' => json_encode(['id' => $id, 'text' => $text]),
                'ignore_errors' => true,
            ],
        ]);
        $response = file_get_contents("{$this->url}/notices", false, $context);
        $status = (int) explode(' ', $http_response_header[0])[1];
        $body = json_decode($response, true);
        if ($status === 200) {
            return ['ok' => true, 'duplicate' => $body['status'] === 'duplicate'];
        }
        return ['ok' => false, 'error' => $body['error']];
    }
}
