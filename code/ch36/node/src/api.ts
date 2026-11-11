// Morada's invoices API, in two modes: "idor" (checks only the token and the
// role) and "fixed" (also checks the relation to each invoice).
import { createServer, type Server } from "node:http";
import { roleAllows, Relations, type User } from "./authorization.ts";
import { invoices, tuples } from "./data.ts";
import { InvalidToken, type Verifier } from "./identity.ts";

export type Mode = "idor" | "fixed";

interface ApiResponse {
  status: number;
  body: unknown;
}

const error = (status: number, type: string): ApiResponse => ({
  status,
  body: { type: `https://morada.test/errors/${type}`, status },
});

export function createApi(mode: Mode, verify: Verifier): Server {
  const relations = new Relations(tuples);
  const can = (u: User, inv: (typeof invoices)[number]) =>
    mode === "idor" || relations.canReadInvoice(u, inv);

  async function handle(method: string, url: string, auth?: string) {
    // 1. Authentication: who is calling?
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
    if (!token) return error(401, "unauthenticated");
    let user: User;
    try {
      user = await verify(token);
    } catch (e) {
      if (e instanceof InvalidToken) return error(401, "invalid-token");
      throw e;
    }
    // 2. Authorization by function (RBAC): does this role use this operation?
    if (!roleAllows(user)) return error(403, "role-not-allowed");

    // 3. Authorization by object: can this user see THIS invoice?
    let m = url.match(/^\/v1\/invoices\/([\w-]+)$/);
    if (method === "GET" && m) {
      const inv = invoices.find((x) => x.id === m![1]);
      // 404 also for what exists but is not yours: it does not reveal that it exists
      if (!inv || !can(user, inv)) return error(404, "invoice-not-found");
      return { status: 200, body: inv };
    }
    m = url.match(/^\/v1\/communities\/([\w-]+)\/invoices$/);
    if (method === "GET" && m) {
      const ofCommunity = invoices.filter((x) => x.community === m![1]);
      const visible = ofCommunity.filter((inv) => can(user, inv));
      if (visible.length === 0) return error(404, "community-not-found");
      return { status: 200, body: visible };
    }
    return error(404, "route-not-found");
  }

  return createServer(async (req, res) => {
    const r = await handle(
      req.method ?? "GET",
      req.url ?? "/",
      req.headers.authorization,
    );
    res.writeHead(r.status, { "content-type": "application/json" });
    res.end(JSON.stringify(r.body));
  });
}
