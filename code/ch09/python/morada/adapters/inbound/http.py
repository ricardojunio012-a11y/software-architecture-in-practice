# HTTP inbound adapter: translates requests into calls to the inbound port and errors
# into status codes. Only it knows FastAPI.
from fastapi import Body, FastAPI, Request
from fastapi.responses import JSONResponse

from morada.application.ports import BookingUseCases
from morada.domain.schedule import NotFoundError, RuleViolatedError

REQUIRED = ["booking", "unit", "space", "date", "start", "end", "requestedOn"]


class InvalidDataError(Exception):
    pass


def create_api(bookings: BookingUseCases) -> FastAPI:
    app = FastAPI()

    @app.get("/spaces")
    def list_spaces():
        return bookings.list_spaces()

    @app.post("/bookings", status_code=201)
    def book(body: dict = Body(default={})):
        missing = [field for field in REQUIRED if field not in body]
        if missing:
            raise InvalidDataError(f"required field: {missing[0]}")
        return bookings.book(body)

    @app.delete("/bookings/{id}")
    def cancel(id: str, on: str = ""):
        return bookings.cancel(id, on)

    @app.get("/spaces/{id}/bookings")
    def bookings_for_space(id: str):
        return bookings.bookings_for_space(id)

    for error, status in [
        (InvalidDataError, 400),
        (NotFoundError, 404),
        (RuleViolatedError, 409),
    ]:

        def handle(_req: Request, e: Exception, status=status):
            return JSONResponse({"error": str(e)}, status_code=status)

        app.add_exception_handler(error, handle)
    return app
