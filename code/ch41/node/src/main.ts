// Runs one version of the lab and writes the output to <data>/output/<version>.
import { mkdirSync, writeFileSync } from "node:fs";
import { Output } from "./common.ts";
import { inventory } from "./versions/inventory.ts";
import { translation } from "./versions/translation.ts";
import { migration } from "./versions/migration.ts";
import { parallel } from "./versions/parallel.ts";
import { decommission } from "./versions/decommission.ts";

const versions: Record<string, (o: Output) => Promise<void>> = {
  inventory,
  translation,
  migration,
  parallel,
  decommission,
};

const [data, version] = process.argv.slice(2);
const run = versions[version];
if (!run) throw new Error(`unknown version: ${version}`);
const output = new Output();
await run(output);
mkdirSync(`${data}/output/${version}`, { recursive: true });
writeFileSync(`${data}/output/${version}/result.txt`, output.lines.join("\n") + "\n");
