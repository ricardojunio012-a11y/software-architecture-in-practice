# Morada's public API for management companies. Errors follow RFC 9457 (problem
# details), the listing is paginated by cursor and the payment requires an
# idempotency key in the Idempotency-Key header. Each management company sees only
# the communities it manages.
import base64
import json
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

import psycopg

PROBLEMS = "https://api.morada.example/problems/"


class Problem(Exception):
    def __init__(self, status: int, type: str, title: str, detail: str):
        super().__init__(detail)
        self.status = status
        self.type = type
        self.title = title

    @property
    def body(self) -> dict:
        return {
            "type": PROBLEMS + self.type,
            "title": self.title,
            "status": self.status,
            "detail": str(self),
        }


def to_json(data) -> str:
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"))


# The cursor is opaque to the client: the page's last identifier, in base64url
def cursor_of(id: str) -> str:
    return base64.urlsafe_b64encode(id.encode()).decode().rstrip("=")


def id_of_cursor(cursor: str) -> str:
    return base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)).decode()


def list_charges(db, company: str, community: str, query: dict) -> tuple[int, dict]:
    received = query.get("limit", ["20"])[0]
    limit = int(received) if received.isdigit() else 0
    if not 1 <= limit <= 100:
        raise Problem(
            400,
            "invalid-limit",
            "Invalid limit",
            f"limit must be between 1 and 100, got {received}",
        )
    status = query.get("status", [None])[0]
    if status is not None and status not in ("open", "paid"):
        raise Problem(
            400,
            "invalid-status",
            "Invalid status",
            f"status must be open or paid, got {status}",
        )
    # Object-level authorization: another management company's community answers as
    # if it did not exist, so as not to reveal even that it exists
    exists = db.execute(
        "SELECT 1 FROM communities WHERE id = %s AND management_company = %s",
        [community, company],
    ).fetchone()
    if exists is None:
        raise Problem(
            404,
            "community-not-found",
            "Community not found",
            f"community {community} does not exist",
        )
    cursor = query.get("cursor", [None])[0]
    after = id_of_cursor(cursor) if cursor else ""
    # One row more than the limit says whether there is a next page
    rows = db.execute(
        """SELECT id, unit, due_date::text, amount_cents, status
           FROM charges
           WHERE community = %s AND (%s::text IS NULL OR status = %s) AND id > %s
           ORDER BY id LIMIT %s""",
        [community, status, status, after, limit + 1],
    ).fetchall()
    data = [
        {
            "id": id,
            "unit": unit,
            "dueDate": due_date,
            "amountCents": amount,
            "status": current_status,
        }
        for id, unit, due_date, amount, current_status in rows[:limit]
    ]
    next = cursor_of(data[-1]["id"]) if len(rows) > limit else None
    return 200, {"data": data, "next": next}


# The payment rules, inside the transaction opened by record_payment
def pay(db, company: str, request: dict) -> tuple[int, dict]:
    # The charge must belong to one of the management company's own communities
    charge = db.execute(
        """SELECT amount_cents, status FROM charges
           WHERE id = %s AND community IN
             (SELECT id FROM communities WHERE management_company = %s)
           FOR UPDATE""",
        [request["charge"], company],
    ).fetchone()
    if charge is None:
        raise Problem(
            422,
            "charge-not-found",
            "Charge not found",
            f"charge {request['charge']} does not exist",
        )
    amount, status = charge
    if status == "paid":
        raise Problem(
            409,
            "charge-already-paid",
            "Charge already paid",
            f"charge {request['charge']} has already been paid",
        )
    if amount != request["amountCents"]:
        raise Problem(
            422,
            "amount-mismatch",
            "Amount mismatch",
            f"charge {request['charge']} is {amount} cents, "
            f"and the payment stated {request['amountCents']}",
        )
    (id,) = db.execute(
        "SELECT 'PAY-' || lpad(nextval('payments_seq')::text, 4, '0')"
    ).fetchone()
    db.execute(
        "INSERT INTO payments VALUES (%s, %s, %s)",
        [id, request["charge"], request["amountCents"]],
    )
    db.execute("UPDATE charges SET status = 'paid' WHERE id = %s", [request["charge"]])
    return 201, {"id": id, **request, "status": "confirmed"}


# Idempotency key: the key and the response are stored in the same transaction as
# the payment. Retrying the request returns the stored response, without paying
# again. The key is scoped to a management company: two companies may generate the
# same one.
def record_payment(db, company: str, key: str | None, body: dict) -> tuple[int, dict]:
    if not key:
        raise Problem(
            400,
            "missing-key",
            "Missing idempotency key",
            "send the Idempotency-Key header with a unique request identifier",
        )
    amount = body.get("amountCents")
    if not isinstance(body.get("charge"), str) or type(amount) is not int:
        raise Problem(
            400,
            "invalid-request",
            "Invalid request",
            "provide charge (string) and amountCents (integer)",
        )
    # The canonical form of the request: only the fields the operation uses, always
    # in the same order. The field order in the client's JSON does not change the
    # comparison.
    request = {"charge": body["charge"], "amountCents": amount}
    with db.transaction():
        # Whoever stores the key first processes the request. A simultaneous request
        # with the same key waits here for the first to finish and finds the response.
        inserted = db.execute(
            "INSERT INTO idempotency_keys (management_company, key, request) "
            "VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
            [company, key, to_json(request)],
        )
        if inserted.rowcount == 0:
            previous, status, response = db.execute(
                "SELECT request, status, response FROM idempotency_keys "
                "WHERE management_company = %s AND key = %s",
                [company, key],
            ).fetchone()
        else:
            try:
                status, response_body = pay(db, company, request)
            except Problem as problem:
                status, response_body = problem.status, problem.body
            response = to_json(response_body)
            db.execute(
                "UPDATE idempotency_keys SET status = %s, response = %s "
                "WHERE management_company = %s AND key = %s",
                [status, response, company, key],
            )
            previous = to_json(request)
    if previous != to_json(request):
        raise Problem(
            422,
            "key-reused",
            "Idempotency key reused",
            f"key {key} was already used with a different request",
        )
    return status, json.loads(response)


CHARGES_ROUTE = re.compile(r"^/v1/communities/([^/]+)/charges$")


def create_api(db_url: str) -> ThreadingHTTPServer:
    class Handler(BaseHTTPRequestHandler):
        def handle_request(self, method: str):
            url = urlsplit(self.path)
            # One connection per request: simultaneous requests use separate
            # transactions
            with psycopg.connect(db_url, autocommit=True) as db:
                try:
                    # In production, the gateway validates the OAuth 2.0 token and
                    # passes on the management company that owns the token. In the
                    # lab, the Morada-Management-Company header plays that role, and
                    # whoever sends it is treated as authenticated.
                    company = self.headers.get("Morada-Management-Company")
                    if not company:
                        raise Problem(
                            401,
                            "unauthenticated",
                            "Client not identified",
                            "send the access token (here, the "
                            "Morada-Management-Company header)",
                        )
                    charges = CHARGES_ROUTE.match(url.path)
                    if method == "GET" and charges:
                        query = parse_qs(url.query)
                        status, body = list_charges(
                            db, company, charges.group(1), query
                        )
                    elif method == "POST" and url.path == "/v1/payments":
                        length = int(self.headers["Content-Length"])
                        request = json.loads(self.rfile.read(length))
                        key = self.headers.get("Idempotency-Key")
                        status, body = record_payment(db, company, key, request)
                    else:
                        raise Problem(
                            404,
                            "route-not-found",
                            "Route not found",
                            f"there is no {method} {url.path}",
                        )
                except Problem as problem:
                    status, body = problem.status, problem.body
            type = "application/problem+json" if status >= 400 else "application/json"
            data = to_json(body).encode()
            self.send_response(status)
            self.send_header("Content-Type", type)
            # The 401 tells the client how to authenticate (RFC 9110)
            if status == 401:
                self.send_header("WWW-Authenticate", "Bearer")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            self.handle_request("GET")

        def do_POST(self):
            self.handle_request("POST")

        def log_message(self, *args):
            pass

    return ThreadingHTTPServer(("127.0.0.1", 0), Handler)


# Starts the server on a thread and returns its address
def start(server: ThreadingHTTPServer) -> str:
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{server.server_address[1]}"
