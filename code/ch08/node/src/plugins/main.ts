// Usage: node main.ts <charges.json> <plugins-folder> <output-folder>
import fs from "node:fs";
import path from "node:path";
import { Core } from "./core.ts";

const [input, pluginsFolder, output] = process.argv.slice(2);
const core = new Core();
await core.load(pluginsFolder);

const { charges } = JSON.parse(fs.readFileSync(input, "utf8"));
const lines = [`plugins loaded: ${core.names().join(", ")}`];
for (const c of charges) lines.push(core.issue(c));

fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "batch.txt"), lines.join("\n") + "\n");
console.log(`${charges.length} charges; output in ${output}`);
