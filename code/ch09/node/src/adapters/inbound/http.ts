// HTTP inbound adapter: translates requests into calls to the inbound port and errors
// into status codes. Only it knows Fastify.
import Fastify from "fastify";
import type { BookingRequest, BookingUseCases } from "../../application/ports.ts";
import { NotFoundError, RuleViolatedError } from "../../domain/schedule.ts";

const REQUIRED = ["booking", "unit", "space", "date", "start", "end", "requestedOn"];

class InvalidDataError extends Error {}

export function createApi(bookings: BookingUseCases) {
  const app = Fastify();

  app.get("/spaces", () => bookings.listSpaces());

  app.post("/bookings", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const missing = REQUIRED.find((field) => body[field] === undefined);
    if (missing) throw new InvalidDataError(`required field: ${missing}`);
    reply.code(201);
    return bookings.book(body as unknown as BookingRequest);
  });

  app.delete<{ Params: { id: string }; Querystring: { on: string } }>(
    "/bookings/:id",
    (req) => bookings.cancel(req.params.id, req.query.on),
  );

  app.get<{ Params: { id: string } }>("/spaces/:id/bookings", (req) =>
    bookings.bookingsForSpace(req.params.id),
  );

  app.setErrorHandler((error, _req, reply) => {
    const status =
      error instanceof InvalidDataError
        ? 400
        : error instanceof NotFoundError
          ? 404
          : error instanceof RuleViolatedError
            ? 409
            : 500;
    reply.code(status).send({ error: error.message });
  });
  return app;
}
