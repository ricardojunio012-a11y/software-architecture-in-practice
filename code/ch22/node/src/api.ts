// One replica of the dashboard API. Port 3000 serves the board presidents, behind the
// load balancer; port 3001 is the lab's admin port, used by the scenarios to choose
// where to keep the sessions and to stop and restart the replica.
import { randomUUID } from "node:crypto";
import http from "node:http";
import { InMemorySessions, RedisSessions, type SessionStore } from "./sessions.ts";

const NAME = process.env.NAME ?? "api";
const stores: Record<string, SessionStore> = {
  memory: new InMemorySessions(),
  redis: await RedisSessions.connect(process.env.REDIS_URL!),
};
let sessions = stores.memory;
let served = 0;

function cookie(request: http.IncomingMessage, name: string) {
  const found = (request.headers.cookie ?? "").match(new RegExp(`${name}=([^;]+)`));
  return found?.[1] ?? null;
}

const pub = http.createServer(async (request, response) => {
  served++;
  response.setHeader("x-replica", NAME);
  if (request.method === "POST" && request.url === "/login") {
    const id = randomUUID();
    await sessions.create(id, "Anna Scott");
    response.setHeader("set-cookie", `sid=${id}; HttpOnly; Path=/`);
    return response.end("ok");
  }
  if (request.url === "/dashboard") {
    const sid = cookie(request, "sid");
    const boardPresident = sid ? await sessions.find(sid) : null;
    response.statusCode = boardPresident ? 200 : 401;
    return response.end(boardPresident ? `dashboard of ${boardPresident}` : "log in");
  }
  response.statusCode = 404;
  response.end();
});
pub.listen(3000);

// Admin: only the lab scenarios call these routes
http
  .createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const servedBefore = served;
    if (url.pathname === "/mode") sessions = stores[url.searchParams.get("session")!];
    if (url.pathname === "/reset") served = 0;
    // No longer accepting connections mimics a replica that went down
    if (url.pathname === "/stop") pub.close();
    if (url.pathname === "/start" && !pub.listening) pub.listen(3000);
    response.end(String(servedBefore));
  })
  .listen(3001);

// Graceful shutdown. On a deploy, Docker or Kubernetes sends SIGTERM and, after a
// grace period, SIGKILL. The replica stops accepting connections, lets the requests
// in flight finish, and only then exits; its own deadline avoids waiting forever.
process.on("SIGTERM", () => {
  pub.close(() => process.exit(0));
  pub.closeIdleConnections();
  setTimeout(() => process.exit(1), 8000).unref();
});
