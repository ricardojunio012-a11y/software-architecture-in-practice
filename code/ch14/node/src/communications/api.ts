// The HTTP API of the Communications service: the provider of the contract.
import http from "node:http";
import { InvalidDataError, type Communications } from "./domain.ts";

export function createApi(communications: Communications) {
  return http.createServer(async (req, res) => {
    const respond = (status: number, body: object) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.method !== "POST" || req.url !== "/notices") {
      return respond(404, { error: "not found" });
    }
    let text = "";
    for await (const chunk of req) text += chunk;
    const notice = JSON.parse(text);
    try {
      const status = await communications.send(notice.id, notice.text);
      respond(200, { notice: notice.id, status });
    } catch (error) {
      if (!(error instanceof InvalidDataError)) throw error;
      respond(400, { error: error.message });
    }
  });
}

// Starts the API on a free port and returns its address
export async function start(server: http.Server): Promise<string> {
  await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
  const { port } = server.address() as { port: number };
  return `http://127.0.0.1:${port}`;
}
