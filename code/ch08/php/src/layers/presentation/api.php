<?php
// Presentation layer: turns HTTP into calls to the application and errors into
// status codes. It is the only layer that knows Slim.
namespace Morada\Layers\Presentation;

require_once __DIR__ . '/../application/booking-service.php';

use Morada\Layers\Application\BookingService;
use Morada\Layers\Domain\{NotFoundError, RuleViolationError};
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

function createApi(BookingService $service): App
{
    $app = AppFactory::create();
    $app->addBodyParsingMiddleware();

    $app->get(
        '/spaces',
        fn(Request $req, Response $res) => json($res, $service->listSpaces()),
    );

    $app->post('/bookings', function (Request $req, Response $res) use ($service) {
        $body = (array) $req->getParsedBody();
        foreach (REQUIRED as $field) {
            if (!isset($body[$field])) {
                throw new InvalidDataError("required field: $field");
            }
        }
        return json($res, $service->book($body), 201);
    });

    $app->delete('/bookings/{id}', function (
        Request $req,
        Response $res,
        array $args,
    ) use ($service) {
        $on = $req->getQueryParams()['on'] ?? '';
        return json($res, $service->cancel($args['id'], $on));
    });

    $app->get('/spaces/{id}/bookings', function (
        Request $req,
        Response $res,
        array $args,
    ) use ($service) {
        return json($res, $service->bookingsForSpace($args['id']));
    });

    // Each kind of error becomes a status code; the domain knows nothing about it
    $app->add(function (Request $req, $next) use ($app) {
        try {
            return $next->handle($req);
        } catch (\Throwable $error) {
            $status = match (true) {
                $error instanceof InvalidDataError => 400,
                $error instanceof NotFoundError => 404,
                $error instanceof RuleViolationError => 409,
                default => 500,
            };
            $response = $app->getResponseFactory()->createResponse();
            return json($response, ['error' => $error->getMessage()], $status);
        }
    });
    return $app;
}
