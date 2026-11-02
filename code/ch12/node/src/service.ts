// The Communications service: the same module, now behind an HTTP API, in its own
// process and container. With FAILURES=yes, it fails on purpose: every 25th call
// it rejects the request, and every 40th call it sends the notice but "loses" the
// response.
import http from "node:http";
import { Communications } from "./communications.ts";

const fail = process.env.FAILURES === "yes";
let communications = new Communications();
let calls = 0;

function reply(res: http.ServerResponse, status: number, body: object) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") return reply(res, 200, {});
  // Lab only: start each run from scratch
  if (req.method === "POST" && req.url === "/reset") {
    communications = new Communications();
    calls = 0;
    return reply(res, 200, {});
  }
  if (req.method !== "POST" || req.url !== "/notices") {
    return reply(res, 404, { error: "not found" });
  }
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const notice = JSON.parse(raw);
  calls += 1;
  if (fail && calls % 25 === 0) return reply(res, 503, { error: "unavailable" });
  const sent = communications.send(notice.id, notice.text);
  if (fail && calls % 40 === 0) return reply(res, 503, { error: "timed out" });
  reply(res, 200, { notice: notice.id, status: sent ? "sent" : "duplicate" });
});

server.listen(8080, () => console.log("Communications listening on port 8080"));
