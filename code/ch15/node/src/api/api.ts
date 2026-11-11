// Morada's public API for management companies. Errors follow RFC 9457 (problem
// details), the listing is paginated by cursor and the payment requires an
// idempotency key in the Idempotency-Key header. Each management company sees only
// the communities it manages.
import http from "node:http";
import type pg from "pg";

const PROBLEMS = "https://api.morada.example/problems/";

class Problem extends Error {
  status: number;
  type: string;
  title: string;

  constructor(status: number, type: string, title: string, detail: string) {
    super(detail);
    this.status = status;
    this.type = type;
    this.title = title;
  }

  get body() {
    const { status, title, message } = this;
    return { type: PROBLEMS + this.type, title, status, detail: message };
  }
}

interface ApiResponse {
  status: number;
  body: object;
}

// The cursor is opaque to the client: the page's last identifier, in base64url
const cursorOf = (id: string) => Buffer.from(id).toString("base64url");
const idOfCursor = (cursor: string) => Buffer.from(cursor, "base64url").toString();

async function listCharges(
  db: pg.Pool,
  company: string,
  community: string,
  query: URLSearchParams,
): Promise<ApiResponse> {
  const limit = Number(query.get("limit") ?? 20);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    const received = query.get("limit");
    throw new Problem(
      400,
      "invalid-limit",
      "Invalid limit",
      `limit must be between 1 and 100, got ${received}`,
    );
  }
  const status = query.get("status");
  if (status !== null && !["open", "paid"].includes(status)) {
    throw new Problem(
      400,
      "invalid-status",
      "Invalid status",
      `status must be open or paid, got ${status}`,
    );
  }
  // Object-level authorization: another management company's community answers as
  // if it did not exist, so as not to reveal even that it exists
  const exists = await db.query(
    "SELECT 1 FROM communities WHERE id = $1 AND management_company = $2",
    [community, company],
  );
  if (exists.rows.length === 0) {
    throw new Problem(
      404,
      "community-not-found",
      "Community not found",
      `community ${community} does not exist`,
    );
  }
  const after = query.has("cursor") ? idOfCursor(query.get("cursor")!) : "";
  // One row more than the limit says whether there is a next page
  const { rows } = await db.query(
    `SELECT id, unit, due_date::text, amount_cents, status FROM charges
     WHERE community = $1 AND ($2::text IS NULL OR status = $2) AND id > $3
     ORDER BY id LIMIT $4`,
    [community, status, after, limit + 1],
  );
  const data = rows.slice(0, limit).map((c) => ({
    id: c.id,
    unit: c.unit,
    dueDate: c.due_date,
    amountCents: c.amount_cents,
    status: c.status,
  }));
  const next = rows.length > limit ? cursorOf(data.at(-1)!.id) : null;
  return { status: 200, body: { data, next } };
}

interface NewPayment {
  charge: string;
  amountCents: number;
}

// The payment rules, inside the transaction opened by recordPayment
async function pay(
  db: pg.PoolClient,
  company: string,
  request: NewPayment,
): Promise<ApiResponse> {
  // The charge must belong to one of the management company's own communities
  const { rows } = await db.query(
    `SELECT amount_cents, status FROM charges
     WHERE id = $1 AND community IN
       (SELECT id FROM communities WHERE management_company = $2)
     FOR UPDATE`,
    [request.charge, company],
  );
  if (rows.length === 0) {
    throw new Problem(
      422,
      "charge-not-found",
      "Charge not found",
      `charge ${request.charge} does not exist`,
    );
  }
  const [charge] = rows;
  if (charge.status === "paid") {
    throw new Problem(
      409,
      "charge-already-paid",
      "Charge already paid",
      `charge ${request.charge} has already been paid`,
    );
  }
  if (charge.amount_cents !== request.amountCents) {
    throw new Problem(
      422,
      "amount-mismatch",
      "Amount mismatch",
      `charge ${request.charge} is ${charge.amount_cents} cents, ` +
        `and the payment stated ${request.amountCents}`,
    );
  }
  const {
    rows: [{ id }],
  } = await db.query(
    "SELECT 'PAY-' || lpad(nextval('payments_seq')::text, 4, '0') AS id",
  );
  await db.query("INSERT INTO payments VALUES ($1, $2, $3)", [
    id,
    request.charge,
    request.amountCents,
  ]);
  await db.query("UPDATE charges SET status = 'paid' WHERE id = $1", [request.charge]);
  const body = { id, ...request, status: "confirmed" };
  return { status: 201, body };
}

// Idempotency key: the key and the response are stored in the same transaction as
// the payment. Retrying the request returns the stored response, without paying
// again. The key is scoped to a management company: two companies may generate the
// same one.
async function recordPayment(
  db: pg.Pool,
  company: string,
  key: string | undefined,
  body: Partial<NewPayment>,
): Promise<ApiResponse> {
  if (!key) {
    throw new Problem(
      400,
      "missing-key",
      "Missing idempotency key",
      "send the Idempotency-Key header with a unique request identifier",
    );
  }
  if (typeof body.charge !== "string" || !Number.isInteger(body.amountCents)) {
    throw new Problem(
      400,
      "invalid-request",
      "Invalid request",
      "provide charge (string) and amountCents (integer)",
    );
  }
  // The canonical form of the request: only the fields the operation uses, always
  // in the same order. The field order in the client's JSON does not change the
  // comparison.
  const request = { charge: body.charge, amountCents: body.amountCents! };
  const conn = await db.connect();
  try {
    await conn.query("BEGIN");
    // Whoever stores the key first processes the request. A simultaneous request
    // with the same key waits here for the first to finish, then finds the response.
    const inserted = await conn.query(
      "INSERT INTO idempotency_keys (management_company, key, request) " +
        "VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [company, key, JSON.stringify(request)],
    );
    if (inserted.rowCount === 0) {
      const {
        rows: [previous],
      } = await conn.query(
        "SELECT request, status, response FROM idempotency_keys " +
          "WHERE management_company = $1 AND key = $2",
        [company, key],
      );
      await conn.query("COMMIT");
      if (previous.request !== JSON.stringify(request)) {
        throw new Problem(
          422,
          "key-reused",
          "Idempotency key reused",
          `key ${key} was already used with a different request`,
        );
      }
      return { status: previous.status, body: JSON.parse(previous.response) };
    }
    let response: ApiResponse;
    try {
      response = await pay(conn, company, request);
    } catch (error) {
      if (!(error instanceof Problem)) throw error;
      response = { status: error.status, body: error.body };
    }
    await conn.query(
      "UPDATE idempotency_keys SET status = $3, response = $4 " +
        "WHERE management_company = $1 AND key = $2",
      [company, key, response.status, JSON.stringify(response.body)],
    );
    await conn.query("COMMIT");
    return response;
  } catch (error) {
    await conn.query("ROLLBACK");
    throw error;
  } finally {
    conn.release();
  }
}

export function createApi(db: pg.Pool) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url!, "http://api");
    let response: ApiResponse;
    try {
      // In production, the gateway validates the OAuth 2.0 token and passes on the
      // management company that owns the token. In the lab, the
      // Morada-Management-Company header plays that role, and whoever sends it is
      // treated as authenticated.
      const company = req.headers["morada-management-company"] as string;
      if (!company) {
        throw new Problem(
          401,
          "unauthenticated",
          "Client not identified",
          "send the access token (here, the Morada-Management-Company header)",
        );
      }
      const charges = url.pathname.match(/^\/v1\/communities\/([^/]+)\/charges$/);
      if (req.method === "GET" && charges) {
        const query = url.searchParams;
        response = await listCharges(db, company, charges[1], query);
      } else if (req.method === "POST" && url.pathname === "/v1/payments") {
        let text = "";
        for await (const part of req) text += part;
        const key = req.headers["idempotency-key"] as string | undefined;
        const body = JSON.parse(text);
        response = await recordPayment(db, company, key, body);
      } else {
        throw new Problem(
          404,
          "route-not-found",
          "Route not found",
          `there is no ${req.method} ${url.pathname}`,
        );
      }
    } catch (error) {
      if (!(error instanceof Problem)) throw error;
      response = { status: error.status, body: error.body };
    }
    const type =
      response.status >= 400 ? "application/problem+json" : "application/json";
    const headers: Record<string, string> = { "Content-Type": type };
    // The 401 tells the client how to authenticate (RFC 9110)
    if (response.status === 401) headers["WWW-Authenticate"] = "Bearer";
    res.writeHead(response.status, headers);
    res.end(JSON.stringify(response.body));
  });
}

// Starts the API on a free port and returns its address
export async function start(server: http.Server): Promise<string> {
  await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
  const { port } = server.address() as { port: number };
  return `http://127.0.0.1:${port}`;
}
