// The knowledge base: indexes each community's documents in pgvector and finds the
// chunks most similar to a question.
import fs from "node:fs";
import path from "node:path";
import type pg from "pg";
import { embed } from "./text.ts";

export interface Chunk {
  document: string;
  text: string;
  similarity: number;
}

// Each file is "<community>-<name>.md"; each paragraph becomes a chunk
export async function indexDocuments(db: pg.Client, folder: string): Promise<number> {
  let total = 0;
  for (const file of fs.readdirSync(folder).sort()) {
    const community = Number(file.split("-")[0]);
    const document = file.replace(/^\d+-/, "").replace(/\.md$/, "");
    const text = fs.readFileSync(path.join(folder, file), "utf8");
    for (const paragraph of text.split(/\n\s*\n/).map((p) => p.trim())) {
      if (!paragraph) continue;
      await db.query(
        "INSERT INTO chunks (community_id, document, text, embedding) " +
          "VALUES ($1, $2, $3, $4)",
        [community, document, paragraph, JSON.stringify(embed(paragraph))],
      );
      total++;
    }
  }
  return total;
}

// The naive assistant's search: the most similar chunks, from any community
export async function searchAll(db: pg.Client, question: string): Promise<Chunk[]> {
  const { rows } = await db.query(
    `SELECT document, text, 1 - (embedding <=> $1) AS similarity
     FROM chunks ORDER BY embedding <=> $1, id LIMIT 3`,
    [JSON.stringify(embed(question))],
  );
  return rows;
}

// The protected assistant's search: the community is required and goes into the
// filter. In production, the RLS policy from chapter 17 enforces the same in the
// database itself.
export async function searchCommunity(
  db: pg.Client,
  community: number,
  question: string,
): Promise<Chunk[]> {
  const { rows } = await db.query(
    `SELECT document, text, 1 - (embedding <=> $1) AS similarity
     FROM chunks WHERE community_id = $2
     ORDER BY embedding <=> $1, id LIMIT 3`,
    [JSON.stringify(embed(question)), community],
  );
  return rows;
}
