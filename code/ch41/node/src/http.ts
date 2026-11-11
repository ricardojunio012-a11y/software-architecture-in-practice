// Real HTTP servers and calls, on ports the system picks inside the container. No
// port is published on the host.
import { createServer } from "node:http";

export type Response = { status: number; body: unknown };
export type Handler = (
  method: string,
  path: string,
  body: unknown,
) => Promise<Response>;

export type Server = { url: string; close: () => Promise<void> };

export async function serve(handle: Handler): Promise<Server> {
  const server = createServer(async (req, res) => {
    let text = "";
    for await (const chunk of req) text += chunk;
    const body = text ? JSON.parse(text) : undefined;
    let r: Response;
    try {
      r = await handle(req.method ?? "GET", req.url ?? "/", body);
    } catch (e) {
      r = { status: 500, body: { error: String(e) } };
    }
    res.writeHead(r.status, { "content-type": "application/json" });
    res.end(JSON.stringify(r.body));
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((ok) => server.close(() => ok())),
  };
}

export async function call(
  base: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const r = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}

// Splits the path and the query: "/a/b?period=10/2026" becomes ["a", "b"] and
// {period: ...}
export function parts(path: string): {
  seg: string[];
  q: URLSearchParams;
} {
  const [p, query] = path.split("?");
  return { seg: p.split("/").filter(Boolean), q: new URLSearchParams(query) };
}
