// Usage: node http.ts memory|postgres <output-folder>
// Starts the HTTP adapter with the chosen repository, sends the requests
// in memory and writes the responses and the final state of the schedules.
import fs from "node:fs";
import path from "node:path";
import { createApi } from "../adapters/inbound/http.ts";
import { slot } from "../domain/schedule.ts";
import { assemble } from "./assemble.ts";

const [repository, output] = process.argv.slice(2);
const { service, schedules, close } = await assemble(repository, true);
const api = createApi(service);
const { requests } = JSON.parse(fs.readFileSync("/data/input/requests.json", "utf8"));

const lines: string[] = [];
for (const r of requests) {
  const response = await api.inject({
    method: r.method,
    url: r.path,
    payload: r.body,
  });
  const body = JSON.stringify(JSON.parse(response.body));
  lines.push(`${r.method} ${r.path} -> ${response.statusCode} ${body}`);
}
const state: string[] = [];
for (const s of await schedules.all()) {
  for (const b of s.bookings()) {
    state.push(`${s.space.id};${b.id};${b.unit};${slot(b)}`);
  }
}
await close();

fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "responses.txt"), lines.join("\n") + "\n");
fs.writeFileSync(path.join(output, "schedules.txt"), state.join("\n") + "\n");
console.log(`${lines.length} requests (${repository}); output in ${output}`);
