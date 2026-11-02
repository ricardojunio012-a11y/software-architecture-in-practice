// HTTP inbound adapter: translates requests into calls to the inbound port and errors
// into status codes. Only it knows Javalin.
package morada.adapters.inbound;

import io.javalin.Javalin;
import java.util.LinkedHashMap;
import java.util.Map;
import morada.application.BookingUseCases;
import morada.application.BookingUseCases.BookingRequest;
import morada.domain.Errors.NotFoundError;
import morada.domain.Errors.RuleViolatedError;

public class Http {

    static class InvalidDataError extends RuntimeException {

        InvalidDataError(String message) {
            super(message);
        }
    }

    static void validate(BookingRequest r) {
        Map<String, Object> fields = new LinkedHashMap<>();
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

    public static Javalin createApi(BookingUseCases bookings) {
        Javalin app = Javalin.create(config -> config.showJavalinBanner = false);

        app.get("/spaces", ctx -> ctx.json(bookings.listSpaces()));

        app.post("/bookings", ctx -> {
            BookingRequest request = ctx.bodyAsClass(BookingRequest.class);
            validate(request);
            ctx.status(201).json(bookings.book(request));
        });

        app.delete("/bookings/{id}", ctx ->
            ctx.json(bookings.cancel(ctx.pathParam("id"), ctx.queryParam("on")))
        );

        app.get("/spaces/{id}/bookings", ctx ->
            ctx.json(bookings.bookingsForSpace(ctx.pathParam("id")))
        );

        app.exception(InvalidDataError.class, (e, ctx) ->
            ctx.status(400).json(Map.of("error", e.getMessage()))
        );
        app.exception(NotFoundError.class, (e, ctx) ->
            ctx.status(404).json(Map.of("error", e.getMessage()))
        );
        app.exception(RuleViolatedError.class, (e, ctx) ->
            ctx.status(409).json(Map.of("error", e.getMessage()))
        );
        return app;
    }
}
