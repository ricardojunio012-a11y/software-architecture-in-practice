<?php
// HTTP inbound adapter: translates requests into calls to the inbound port and errors
// into status codes. Only it knows Slim.
namespace Morada\Adapters\Inbound;

require_once __DIR__ . '/../../application/ports.php';

use Morada\Application\BookingUseCases;
use Morada\Domain\{NotFoundError, RuleViolatedError};
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;
use Slim\Factory\AppFactory;

const REQUIRED = ['booking', 'unit', 'space', 'date', 'start', 'end', 'requestedOn'];

class InvalidDataError extends \RuntimeException {}

function json(Response $response, mixed $data, int $status = 200): Response
{
    $response->getBody()->write(json_encode($data, JSON_UNESCAPED_UNICODE));
    return $response
        ->withStatus($status)
        ->withHeader('Content-Type', 'application/json');
}

function createApi(BookingUseCases $bookings): App
{
    $app = AppFactory::create();
    $app->addBodyParsingMiddleware();

    $app->get(
        '/spaces',
        fn(Request $req, Response $res) => json($res, $bookings->listSpaces()),
    );

    $app->post('/bookings', function (Request $req, Response $res) use ($bookings) {
        $body = (array) $req->getParsedBody();
        foreach (REQUIRED as $field) {
            if (!isset($body[$field])) {
                throw new InvalidDataError("required field: $field");
            }
        }
        return json($res, $bookings->book($body), 201);
    });

    $app->delete('/bookings/{id}', function (
        Request $req,
        Response $res,
        array $args,
    ) use ($bookings) {
        $on = $req->getQueryParams()['on'] ?? '';
        return json($res, $bookings->cancel($args['id'], $on));
    });

    $app->get('/spaces/{id}/bookings', function (
        Request $req,
        Response $res,
        array $args,
    ) use ($bookings) {
        return json($res, $bookings->bookingsForSpace($args['id']));
    });

    $app->add(function (Request $req, $next) use ($app) {
        try {
            return $next->handle($req);
        } catch (\Throwable $error) {
            $status = match (true) {
                $error instanceof InvalidDataError => 400,
                $error instanceof NotFoundError => 404,
                $error instanceof RuleViolatedError => 409,
                default => 500,
            };
            $response = $app->getResponseFactory()->createResponse();
            return json($response, ['error' => $error->getMessage()], $status);
        }
    });
    return $app;
}
