<?php
// Morada's public API for management companies. Errors follow RFC 9457 (problem
// details), the listing is paginated by cursor and the payment requires an
// idempotency key in the Idempotency-Key header. Each management company sees only
// the communities it manages.
namespace Morada\Api;

use PDO;

require_once __DIR__ . '/db.php';

const PROBLEMS = 'https://api.morada.example/problems/';

class Problem extends \Exception
{
    public function __construct(
        public readonly int $status,
        public readonly string $type,
        public readonly string $title,
        string $detail,
    ) {
        parent::__construct($detail);
    }

    public function body(): array
    {
        return [
            'type' => PROBLEMS . $this->type,
            'title' => $this->title,
            'status' => $this->status,
            'detail' => $this->getMessage(),
        ];
    }
}

function toJson($data): string
{
    return json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

// The cursor is opaque to the client: the page's last identifier, in base64url
function cursorOf(string $id): string
{
    return rtrim(strtr(base64_encode($id), '+/', '-_'), '=');
}

function idOfCursor(string $cursor): string
{
    return base64_decode(strtr($cursor, '-_', '+/'));
}

function listCharges(PDO $db, string $company, string $community, array $query): array
{
    $received = $query['limit'] ?? '20';
    $limit = ctype_digit($received) ? (int) $received : 0;
    if ($limit < 1 || $limit > 100) {
        throw new Problem(
            400,
            'invalid-limit',
            'Invalid limit',
            "limit must be between 1 and 100, got $received",
        );
    }
    $status = $query['status'] ?? null;
    if ($status !== null && !in_array($status, ['open', 'paid'], true)) {
        throw new Problem(
            400,
            'invalid-status',
            'Invalid status',
            "status must be open or paid, got $status",
        );
    }
    // Object-level authorization: another management company's community answers as
    // if it did not exist, so as not to reveal even that it exists
    $exists = $db->prepare(
        'SELECT 1 FROM communities WHERE id = ? AND management_company = ?',
    );
    $exists->execute([$community, $company]);
    if ($exists->fetch() === false) {
        throw new Problem(
            404,
            'community-not-found',
            'Community not found',
            "community $community does not exist",
        );
    }
    $after = isset($query['cursor']) ? idOfCursor($query['cursor']) : '';
    // One row more than the limit says whether there is a next page
    $select = $db->prepare(
        <<<SQL
        SELECT id, unit, due_date::text AS due_date, amount_cents, status
        FROM charges
        WHERE community = ? AND (?::text IS NULL OR status = ?) AND id > ?
        ORDER BY id LIMIT ?
        SQL
        ,
    );
    $select->execute([$community, $status, $status, $after, $limit + 1]);
    $rows = $select->fetchAll(PDO::FETCH_ASSOC);
    $data = array_map(
        fn($c) => [
            'id' => $c['id'],
            'unit' => $c['unit'],
            'dueDate' => $c['due_date'],
            'amountCents' => $c['amount_cents'],
            'status' => $c['status'],
        ],
        array_slice($rows, 0, $limit),
    );
    $next = count($rows) > $limit ? cursorOf(end($data)['id']) : null;
    return [200, ['data' => $data, 'next' => $next]];
}

// The payment rules, inside the transaction opened by recordPayment
function pay(PDO $db, string $company, array $request): array
{
    // The charge must belong to one of the management company's own communities
    $query = $db->prepare(
        <<<SQL
        SELECT amount_cents, status FROM charges
        WHERE id = ? AND community IN
          (SELECT id FROM communities WHERE management_company = ?)
        FOR UPDATE
        SQL
        ,
    );
    $query->execute([$request['charge'], $company]);
    $charge = $query->fetch(PDO::FETCH_ASSOC);
    if ($charge === false) {
        throw new Problem(
            422,
            'charge-not-found',
            'Charge not found',
            "charge {$request['charge']} does not exist",
        );
    }
    if ($charge['status'] === 'paid') {
        throw new Problem(
            409,
            'charge-already-paid',
            'Charge already paid',
            "charge {$request['charge']} has already been paid",
        );
    }
    if ($charge['amount_cents'] !== $request['amountCents']) {
        throw new Problem(
            422,
            'amount-mismatch',
            'Amount mismatch',
            "charge {$request['charge']} is {$charge['amount_cents']} cents, " .
                "and the payment stated {$request['amountCents']}",
        );
    }
    $id = $db
        ->query("SELECT 'PAY-' || lpad(nextval('payments_seq')::text, 4, '0')")
        ->fetchColumn();
    $db->prepare('INSERT INTO payments VALUES (?, ?, ?)')->execute([
        $id,
        $request['charge'],
        $request['amountCents'],
    ]);
    $db->prepare("UPDATE charges SET status = 'paid' WHERE id = ?")->execute([
        $request['charge'],
    ]);
    return [201, ['id' => $id, ...$request, 'status' => 'confirmed']];
}

// Idempotency key: the key and the response are stored in the same transaction as
// the payment. Retrying the request returns the stored response, without paying
// again. The key is scoped to a management company: two companies may generate the
// same one.
function recordPayment(PDO $db, string $company, ?string $key, array $body): array
{
    if ($key === null || $key === '') {
        throw new Problem(
            400,
            'missing-key',
            'Missing idempotency key',
            'send the Idempotency-Key header with a unique request identifier',
        );
    }
    if (!is_string($body['charge'] ?? null) || !is_int($body['amountCents'] ?? null)) {
        throw new Problem(
            400,
            'invalid-request',
            'Invalid request',
            'provide charge (string) and amountCents (integer)',
        );
    }
    // The canonical form of the request: only the fields the operation uses, always
    // in the same order. The field order in the client's JSON does not change the
    // comparison.
    $request = [
        'charge' => $body['charge'],
        'amountCents' => $body['amountCents'],
    ];
    $db->beginTransaction();
    try {
        // Whoever stores the key first processes the request. A simultaneous request
        // with the same key waits here for the first to finish and finds the response.
        $inserted = $db->prepare(
            'INSERT INTO idempotency_keys (management_company, key, request) ' .
                'VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
        );
        $inserted->execute([$company, $key, toJson($request)]);
        if ($inserted->rowCount() === 0) {
            $query = $db->prepare(
                'SELECT request, status, response FROM idempotency_keys ' .
                    'WHERE management_company = ? AND key = ?',
            );
            $query->execute([$company, $key]);
            $previous = $query->fetch(PDO::FETCH_ASSOC);
            $db->commit();
            if ($previous['request'] !== toJson($request)) {
                throw new Problem(
                    422,
                    'key-reused',
                    'Idempotency key reused',
                    "key $key was already used with a different request",
                );
            }
            return [$previous['status'], json_decode($previous['response'], true)];
        }
        try {
            [$status, $response] = pay($db, $company, $request);
        } catch (Problem $problem) {
            [$status, $response] = [$problem->status, $problem->body()];
        }
        $db->prepare(
            'UPDATE idempotency_keys SET status = ?, response = ? ' .
                'WHERE management_company = ? AND key = ?',
        )->execute([$status, toJson($response), $company, $key]);
        $db->commit();
        return [$status, $response];
    } catch (\Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $error;
    }
}

// Handles an HTTP request and returns [status, body]
function handle(
    PDO $db,
    string $method,
    string $path,
    array $query,
    ?string $company,
    ?string $key,
    string $body,
): array {
    try {
        // In production, the gateway validates the OAuth 2.0 token and passes on the
        // management company that owns the token. In the lab, the
        // Morada-Management-Company header plays that role, and whoever sends it is
        // treated as authenticated.
        if ($company === null || $company === '') {
            throw new Problem(
                401,
                'unauthenticated',
                'Client not identified',
                'send the access token (here, the Morada-Management-Company header)',
            );
        }
        if (
            $method === 'GET' &&
            preg_match('#^/v1/communities/([^/]+)/charges$#', $path, $m)
        ) {
            return listCharges($db, $company, $m[1], $query);
        }
        if ($method === 'POST' && $path === '/v1/payments') {
            $request = json_decode($body, true);
            return recordPayment($db, $company, $key, $request);
        }
        throw new Problem(
            404,
            'route-not-found',
            'Route not found',
            "there is no $method $path",
        );
    } catch (Problem $problem) {
        return [$problem->status, $problem->body()];
    }
}
