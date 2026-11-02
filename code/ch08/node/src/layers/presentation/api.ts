// Presentation layer: turns HTTP into calls to the application and errors into
// status codes. It is the only layer that knows Fastify.
import Fastify from "fastify";
import type { BookingRequest, BookingService } from "../application/booking-service.ts";
import { NotFoundError, RuleViolationError } from "../domain/domain.ts";

const REQUIRED = ["booking", "unit", "space", "date", "start", "end", "requestedOn"];

class InvalidDataError extends Error {}

export function createApi(service: BookingService) {
  const app = Fastify();

  app.get("/spaces", async () => service.listSpaces());

  app.post("/bookings", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const missing = REQUIRED.find((field) => body[field] === undefined);
    if (missing) throw new InvalidDataError(`required field: ${missing}`);
    reply.code(201);
    return service.book(body as unknown as BookingRequest);
  });

  app.delete<{ Params: { id: string }; Querystring: { on: string } }>(
    "/bookings/:id",
    async (req) => service.cancel(req.params.id, req.query.on),
  );

  app.get<{ Params: { id: string } }>("/spaces/:id/bookings", async (req) =>
    service.bookingsForSpace(req.params.id),
  );

  // Each kind of error becomes a status code; the domain knows nothing about it
  app.setErrorHandler((error, _req, reply) => {
    const status =
      error instanceof InvalidDataError
        ? 400
        : error instanceof NotFoundError
          ? 404
          : error instanceof RuleViolationError
            ? 409
            : 500;
    reply.code(status).send({ error: error.message });
  });
  return app;
}
