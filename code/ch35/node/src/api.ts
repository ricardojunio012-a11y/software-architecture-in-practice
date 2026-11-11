// One replica of the notices API. Port 8080 serves the public; 9090 is the admin
// port, which the chaos experiment uses to take the replica down and bring it back.
import http from "node:http";

const replica = process.env.REPLICA ?? "api";
const zone = process.env.ZONE ?? "a";
let publicServer: http.Server | null = null;

function open(): Promise<void> {
  if (publicServer) return Promise.resolve();
  const s = http.createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ replica, zone, notices: ["Pump maintenance"] }));
  });
  publicServer = s;
  return new Promise((ok) => s.listen(8080, ok));
}

// Take down = stop accepting connections, like a dead process or a zone with no network
function close(): Promise<void> {
  const s = publicServer;
  publicServer = null;
  if (!s) return Promise.resolve();
  s.closeAllConnections();
  return new Promise((ok) => s.close(() => ok()));
}

http
  .createServer(async (request, response) => {
    if (request.url === "/chaos/kill") await close();
    if (request.url === "/chaos/restore") await open();
    response.end(JSON.stringify({ replica, zone, up: publicServer !== null }));
  })
  .listen(9090);
await open();
console.log(`${replica} (zone ${zone}) up`);
