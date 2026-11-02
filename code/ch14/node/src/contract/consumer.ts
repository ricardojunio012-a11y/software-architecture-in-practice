// Consumer-side contract test. A test double answers exactly what each interaction
// promises; the monolith's real client talks to it. If the client understands every
// response, the interactions become the published contract.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { start } from "../communications/api.ts";
import { CommunicationsClient } from "../monolith/client.ts";
import { INTERACTIONS, type Interaction } from "./interactions.ts";

const outDir = process.argv[2];
let current: Interaction;

// The provider double: checks the request and returns the agreed response
const double = http.createServer(async (req, res) => {
  let text = "";
  for await (const chunk of req) text += chunk;
  const expected = current.request;
  const same =
    req.method === expected.method &&
    req.url === expected.path &&
    JSON.stringify(JSON.parse(text)) === JSON.stringify(expected.body);
  res.writeHead(same ? current.response.status : 500, {
    "Content-Type": "application/json",
  });
  const body = same ? current.response.body : { error: "unexpected request" };
  res.end(JSON.stringify(body));
});
const client = new CommunicationsClient(await start(double));

// What the monolith must understand from each response
const expected: Record<string, object> = {
  "sending a new notice": { ok: true, duplicate: false },
  "resending a notice already sent": { ok: true, duplicate: true },
  "notice without text": { ok: false, error: "text is required" },
};

const report: string[] = [];
for (const interaction of INTERACTIONS) {
  current = interaction;
  const { id, text } = interaction.request.body as { id: string; text: string };
  const result = await client.send(id, text);
  const ok =
    JSON.stringify(result) === JSON.stringify(expected[interaction.description]);
  report.push(`${interaction.description}: ${ok ? "the client understood" : "FAILED"}`);
}
double.close();

const contract = {
  consumer: "monolith",
  provider: "communications",
  interactions: INTERACTIONS,
};
fs.mkdirSync(path.join(outDir, "consumer"), { recursive: true });
fs.writeFileSync(
  path.join(outDir, "consumer", "contract.json"),
  JSON.stringify(contract, null, 2) + "\n",
);
fs.writeFileSync(path.join(outDir, "consumer", "report.txt"), report.join("\n") + "\n");
console.log(`consumer: ${INTERACTIONS.length} interactions in the contract`);
