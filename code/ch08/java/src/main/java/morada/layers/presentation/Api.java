// Presentation layer: turns HTTP into calls to the application and errors into
// status codes. It is the only layer that knows Javalin.
package morada.layers.presentation;

import io.javalin.Javalin;
import java.util.Map;
import morada.layers.application.BookingService;
import morada.layers.application.BookingService.BookingRequest;
import morada.layers.domain.Errors.NotFoundError;
import morada.layers.domain.Errors.RuleViolationError;

public class Api {

    static class InvalidDataError extends RuntimeException {

        InvalidDataError(String message) {
            super(message);
        }
    }

    static void validate(BookingRequest r) {
        Map<String, Object> fields = new java.util.LinkedHashMap<>();
        fields.put("booking", r.booking());
        fields.put("unit", r.unit());
        fields.put("space", r.space());
        fields.put("date", r.date());
        fields.put("start", r.start());
        fields.put("end", r.end());
        fields.put("requestedOn", r.requestedOn());
        fields.forEach((field, value) -> {
            if (value == null) throw new InvalidDataError("required field: " + field);
        });
    }

    public static Javalin create(BookingService service) {
        Javalin app = Javalin.create(config -> config.showJavalinBanner = false);

        app.get("/spaces", ctx -> ctx.json(service.listSpaces()));

        app.post("/bookings", ctx -> {
            BookingRequest request = ctx.bodyAsClass(BookingRequest.class);
            validate(request);
            ctx.status(201).json(service.book(request));
        });

        app.delete("/bookings/{id}", ctx ->
            ctx.json(service.cancel(ctx.pathParam("id"), ctx.queryParam("on")))
        );

        app.get("/spaces/{id}/bookings", ctx ->
            ctx.json(service.bookingsForSpace(ctx.pathParam("id")))
        );

        // Each kind of error becomes a status code; the domain knows nothing about it
        app.exception(InvalidDataError.class, (e, ctx) ->
            ctx.status(400).json(Map.of("error", e.getMessage()))
        );
        app.exception(NotFoundError.class, (e, ctx) ->
            ctx.status(404).json(Map.of("error", e.getMessage()))
        );
        app.exception(RuleViolationError.class, (e, ctx) ->
            ctx.status(409).json(Map.of("error", e.getMessage()))
        );
        return app;
    }
}
