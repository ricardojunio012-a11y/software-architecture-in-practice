// The "variation" version: the hard part of evaluation. The same suite runs five times
// against the protected assistant with a model that varies, and each run is checked
// two ways: by the exact text and by the content, after normalizing the form.
import { Assistant } from "./assistant.ts";
import { Budget } from "./guards.ts";
import { DONT_KNOW } from "./model.ts";
import { VariableModel } from "./variable-model.ts";
import { prepare, readJson, writeOutput } from "./prepare.ts";

interface Case {
  community: number;
  question: string;
  mustContain: string;
}

// Checking by content: equivalent forms become one before comparing
const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/(\d+):00 ([ap])m\b/g, "$1 $2.m.")
    .replace(/\$(\d+)\.00/g, "$1 dollars")
    .replace(/\bfour\b/g, "4")
    .replace(/\bsix\b/g, "6");

const dataDir = process.argv[2];
const { cases } = readJson(dataDir, "evaluation.json") as { cases: Case[] };
const { db } = await prepare(dataDir);
const noLimit = { "12": 1e9, "15": 1e9, "20": 1e9 };
const SEEDS = [1, 2, 3, 4, 5];

const lines: string[] = [];
const totals = { text: [] as number[], content: [] as number[] };
const realFailures = new Map<string, number>();
for (const seed of SEEDS) {
  const assistant = new Assistant(
    db,
    new VariableModel(seed),
    new Budget(noLimit),
    true,
  );
  let byText = 0;
  let byContent = 0;
  const errors: string[] = [];
  for (const c of cases) {
    const { text } = await assistant.answer(c.community, c.question);
    const expected = c.mustContain === "dont_know" ? DONT_KNOW : c.mustContain;
    if (text.includes(expected)) byText++;
    if (normalize(text).includes(normalize(expected))) byContent++;
    else {
      const name = `[${c.community}] ${c.question}`;
      realFailures.set(name, (realFailures.get(name) ?? 0) + 1);
      errors.push(`       ${name}`, `         answered: ${text}`);
    }
  }
  totals.text.push(byText);
  totals.content.push(byContent);
  lines.push(
    `run ${seed}: by text ${byText} of ${cases.length}, ` +
      `by content ${byContent} of ${cases.length}`,
    ...errors,
  );
}

const summary = (n: number[]) => {
  const mean = (n.reduce((a, b) => a + b, 0) / n.length).toFixed(1);
  return `min ${Math.min(...n)}, max ${Math.max(...n)}, mean ${mean}`;
};
lines.push(
  "",
  `by text:    ${summary(totals.text)}`,
  `by content: ${summary(totals.content)}`,
  "",
  "cases that failed by content, in how many of the runs:",
);
for (const [name, times] of [...realFailures].sort((a, b) => b[1] - a[1]))
  lines.push(`  ${times} of ${SEEDS.length}  ${name}`);
await db.end();
writeOutput(dataDir, "variation", "result.txt", lines);
console.log("variation: suite run five times with the model that varies");
