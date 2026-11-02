// Provider-side contract verification. Reads the contract the consumer published,
// sets up the state each interaction asks for, sends the request to the real
// Communications API and compares the response with the agreed one.
import fs from "node:fs";
import path from "node:path";
import { createApi, start } from "../communications/api.ts";
import { Communications, InMemoryNotices } from "../communications/domain.ts";
import type { Interaction } from "./interactions.ts";

const outDir = process.argv[2];
const contract = JSON.parse(
  fs.readFileSync(path.join(outDir, "consumer", "contract.json"), "utf8"),
);

// Each state in the contract has a setup on the provider side
const states: Record<string, (c: Communications) => Promise<unknown>> = {
  "no notice has been sent": async () => {},
  "notice E-P-001 has already been sent": (c) => c.send("E-P-001", "payment received"),
};

// The response satisfies the contract if it has the agreed status and the fields
// the consumer declared. Extra fields break no one.
function satisfies(actual: Interaction["response"], expected: Interaction["response"]) {
  const body = actual.body as Record<string, unknown>;
  return (
    actual.status === expected.status &&
    Object.entries(expected.body).every(([field, value]) => body[field] === value)
  );
}

const report: string[] = [];
for (const interaction of contract.interactions as Interaction[]) {
  const communications = new Communications(new InMemoryNotices());
  await states[interaction.state](communications);
  const api = createApi(communications);
  const url = await start(api);
  const response = await fetch(url + interaction.request.path, {
    method: interaction.request.method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(interaction.request.body),
  });
  const actual = { status: response.status, body: await response.json() };
  api.close();
  const expected = JSON.stringify(interaction.response);
  const received = JSON.stringify(actual);
  const failure = `FAILED (expected ${expected}, received ${received})`;
  const ok = satisfies(actual, interaction.response);
  report.push(`${interaction.description}: ${ok ? "verified" : failure}`);
}

fs.mkdirSync(path.join(outDir, "provider"), { recursive: true });
fs.writeFileSync(path.join(outDir, "provider", "report.txt"), report.join("\n") + "\n");
console.log(`provider: ${report.length} interactions verified`);
process.exitCode = report.some((l) => l.includes("FAILED")) ? 1 : 0;
