// Usage: node main.ts <requests.json> <output-folder>
// Assembles the layers from the bottom up and sends the requests to the API, in memory
// (without opening a port), writing each response.
import fs from "node:fs";
import path from "node:path";
import { BookingService } from "./application/booking-service.ts";
import { createApi } from "./presentation/api.ts";
import { ScheduleRepository } from "./data/repository.ts";

const [input, output] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(input, "utf8"));
const api = createApi(new BookingService(new ScheduleRepository(data.spaces)));

const lines: string[] = [];
for (const r of data.requests) {
  const response = await api.inject({
    method: r.method,
    url: r.path,
    payload: r.body,
  });
  const body = JSON.stringify(JSON.parse(response.body));
  lines.push(`${r.method} ${r.path} -> ${response.statusCode} ${body}`);
}
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "responses.txt"), lines.join("\n") + "\n");
console.log(`${lines.length} requests; output in ${output}`);
