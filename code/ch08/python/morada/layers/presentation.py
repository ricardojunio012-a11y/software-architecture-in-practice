# Presentation layer: turns HTTP into calls to the application and errors into
# status codes. It is the only layer that knows FastAPI.
from fastapi import Body, FastAPI, Request
from fastapi.responses import JSONResponse

from morada.layers.application import BookingService
from morada.layers.domain import NotFoundError, RuleViolationError

REQUIRED = ["booking", "unit", "space", "date", "start", "end", "requestedOn"]


class InvalidDataError(Exception):
    pass


def create_api(service: BookingService) -> FastAPI:
    app = FastAPI()

    @app.get("/spaces")
    def list_spaces():
        return service.list_spaces()

    @app.post("/bookings", status_code=201)
    def book(body: dict = Body(default={})):
        missing = [field for field in REQUIRED if field not in body]
        if missing:
            raise InvalidDataError(f"required field: {missing[0]}")
        return service.book(body)

    @app.delete("/bookings/{id}")
    def cancel(id: str, on: str = ""):
        return service.cancel(id, on)

    @app.get("/spaces/{id}/bookings")
    def bookings_for_space(id: str):
        return service.bookings_for_space(id)

    # Each kind of error becomes a status code; the domain knows nothing about it
    for error, status in [
        (InvalidDataError, 400),
        (NotFoundError, 404),
        (RuleViolationError, 409),
    ]:

        def handle(_req: Request, e: Exception, status=status):
            return JSONResponse({"error": str(e)}, status_code=status)

        app.add_exception_handler(error, handle)
    return app
