// Creates the knowledge base from the input documents.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { indexDocuments } from "./knowledge-base.ts";

export async function prepare(dataDir: string) {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await db.query(fs.readFileSync(path.join(dataDir, "sql", "schema.sql"), "utf8"));
  const chunks = await indexDocuments(db, path.join(dataDir, "input", "documents"));
  return { db, chunks };
}

export const readJson = (dataDir: string, file: string) =>
  JSON.parse(fs.readFileSync(path.join(dataDir, "input", file), "utf8"));

export function writeOutput(
  dataDir: string,
  version: string,
  file: string,
  lines: string[],
) {
  const output = path.join(dataDir, "output", version);
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, file), lines.join("\n") + "\n");
}
