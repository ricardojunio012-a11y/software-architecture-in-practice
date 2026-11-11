// One API replica: the resident opens a WebSocket and says which unit they are in; the
// front-desk staff register a visitor over HTTP, and the notice must reach the
// resident, whether they are connected to this replica or to the other one. With Redis,
// each replica publishes the notice on a channel, and every replica receives it and
// delivers it to its own connections.
import http from "node:http";
import { createClient } from "redis";
import { WebSocketServer, type WebSocket } from "ws";

const NAME = process.env.NAME ?? "api";
const connected = new Map<string, Set<WebSocket>>(); // unit -> connections
let useRedis = false;

const publisher = createClient({ url: process.env.REDIS_URL });
const subscriber = publisher.duplicate();
await Promise.all([publisher.connect(), subscriber.connect()]);

function deliverLocal(unit: string, notice: string) {
  for (const ws of connected.get(unit) ?? []) ws.send(`${notice} (via ${NAME})`);
}

// Every replica subscribes to the notices channel and delivers to its own residents
await subscriber.subscribe("notices", (message) => {
  const { unit, notice } = JSON.parse(message);
  deliverLocal(unit, notice);
});

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (url.pathname === "/mode") {
    useRedis = url.searchParams.get("redis") === "yes";
    return response.end("ok");
  }
  if (request.method === "POST" && url.pathname === "/visitors") {
    const unit = url.searchParams.get("unit")!;
    const notice = `visitor for ${unit}: ${url.searchParams.get("name")}`;
    if (useRedis) await publisher.publish("notices", JSON.stringify({ unit, notice }));
    else deliverLocal(unit, notice);
    return response.end("registered");
  }
  response.statusCode = 404;
  response.end();
});

new WebSocketServer({ server }).on("connection", (ws, request) => {
  const unit = new URL(request.url ?? "/", "http://localhost").searchParams.get(
    "unit",
  )!;
  if (!connected.has(unit)) connected.set(unit, new Set());
  connected.get(unit)!.add(ws);
  ws.on("close", () => connected.get(unit)!.delete(ws));
  ws.send("connected");
});
server.listen(3000);
