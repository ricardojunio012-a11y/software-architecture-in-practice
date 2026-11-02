// Usage: node main.ts <commands.json> <output-folder>
import fs from "node:fs";
import path from "node:path";
import { bookings } from "./model.ts";
import { book, cancel } from "./service.ts";

const [input, output] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(input, "utf8"));
const events: string[] = [];
const results = data.commands.map((c: any) => {
  const space = data.spaces.find((s: any) => s.id === c.space);
  const r = c.type === "book" ? book(c, space, events) : cancel(c, events);
  return `${c.booking};${c.type};${r}`;
});
const hh = (h: number) => String(h).padStart(2, "0") + ":00";
const schedule = data.spaces.flatMap((s: any) =>
  bookings
    .filter((b) => b.space === s.id && b.status === "confirmed")
    .map((b) => `${b.space};${b.id};${b.date} ${hh(b.start)}-${hh(b.end)};${b.unit}`),
);

fs.mkdirSync(output, { recursive: true });
for (const [name, lines] of Object.entries({ results, events, schedule })) {
  fs.writeFileSync(
    path.join(output, `${name}.txt`),
    (lines as string[]).join("\n") + "\n",
  );
}
console.log(`${results.length} commands executed; output in ${output}`);
