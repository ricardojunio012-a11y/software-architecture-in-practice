// Writes the result of a version to output/<version>/result.txt and prints it.
import fs from "node:fs";
import path from "node:path";

export function write(version: string, lines: string[]) {
  const folder = path.join(process.argv[2] ?? "/data", "output", version);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, "result.txt"), lines.join("\n") + "\n");
  console.log(lines.join("\n"));
}
