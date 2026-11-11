// The "assistant" version: a sequence of questions from three communities to the
// protected assistant, with the origin of each answer and the cost in tokens.
import { Assistant } from "./assistant.ts";
import { Budget } from "./guards.ts";
import { ExtractiveModel } from "./model.ts";
import { prepare, readJson, writeOutput } from "./prepare.ts";

const dataDir = process.argv[2];
const conversation = readJson(dataDir, "conversation.json");
const { db, chunks } = await prepare(dataDir);
const budget = new Budget(conversation.dailyTokenBudget);
const assistant = new Assistant(db, new ExtractiveModel(), budget, true);
const fmt = (n: number) => n.toLocaleString("en-US");

const lines = [`knowledge base: ${chunks} chunks`, ""];
for (const { community, question } of conversation.questions) {
  const a = await assistant.answer(community, question);
  const discarded = a.discarded ? `, ${a.discarded} chunk(s) discarded` : "";
  lines.push(
    `[${community}] ${question}`,
    `     ${a.text}`,
    `     origin: ${a.origin}, ${a.tokens} tokens${discarded}`,
  );
}
lines.push("", "tokens spent today per community:");
for (const c of Object.keys(conversation.dailyTokenBudget)) {
  const limit = conversation.dailyTokenBudget[c];
  lines.push(`  ${c}: ${fmt(budget.spent(Number(c)))} of ${fmt(limit)}`);
}
await db.end();
writeOutput(dataDir, "assistant", "conversation.txt", lines);
console.log(`assistant: ${conversation.questions.length} questions answered`);
