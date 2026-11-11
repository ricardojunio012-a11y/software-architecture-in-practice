// The "evaluation" version: the same suite of cases against the naive assistant and
// against the protected one. A case passes if the answer contains the expected text
// or, when the right answer is not knowing, if the assistant admits it did not find it.
import { Assistant } from "./assistant.ts";
import { Budget } from "./guards.ts";
import { DONT_KNOW, ExtractiveModel } from "./model.ts";
import { prepare, readJson, writeOutput } from "./prepare.ts";

interface Case {
  community: number;
  question: string;
  mustContain: string;
}

const dataDir = process.argv[2];
const { cases } = readJson(dataDir, "evaluation.json") as { cases: Case[] };
const { db } = await prepare(dataDir);
const noLimit = { "12": 1e9, "15": 1e9, "20": 1e9 };

const lines: string[] = [];
for (const isProtected of [false, true]) {
  const name = isProtected ? "protected assistant" : "naive assistant";
  const assistant = new Assistant(
    db,
    new ExtractiveModel(),
    new Budget(noLimit),
    isProtected,
  );
  let correct = 0;
  lines.push(`== ${name}`);
  for (const c of cases) {
    const { text } = await assistant.answer(c.community, c.question);
    const expected = c.mustContain === "dont_know" ? DONT_KNOW : c.mustContain;
    const passed = text.includes(expected);
    if (passed) correct++;
    lines.push(`${passed ? "ok    " : "FAILED"} [${c.community}] ${c.question}`);
    if (!passed) lines.push(`       answered: ${text}`);
  }
  lines.push(`correct: ${correct} of ${cases.length}`, "");
}
await db.end();
writeOutput(dataDir, "evaluation", "result.txt", lines);
console.log("evaluation: suite run against both assistants");
