// The language model port. The assistant does not know which model answers: in
// production, an adapter calls a local model or an API; in the lab, a deterministic
// extractive model picks the sentence from the chunks that best answers the question.
import type { Chunk } from "./knowledge-base.ts";
import { tokens, words } from "./text.ts";

export interface Response {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface Model {
  answer(instructions: string, question: string, chunks: Chunk[]): Response;
}

export const DONT_KNOW = "I could not find this in the community's documents.";

// A sentence ends at a period followed by a capital letter ("10 p.m. to" does not)
export const sentences = (text: string) => text.split(/(?<=\.)\s+(?=[A-Z])/);

export class ExtractiveModel implements Model {
  answer(instructions: string, question: string, chunks: Chunk[]): Response {
    const prompt = [instructions, ...chunks.map((c) => c.text), question].join("\n");
    const wanted = new Set(words(question));
    let best = { sentence: "", document: "", points: 0 };
    for (const c of chunks) {
      for (const sentence of sentences(c.text)) {
        const points = new Set(words(sentence).filter((w) => wanted.has(w))).size;
        if (points > best.points) best = { sentence, document: c.document, points };
      }
    }
    // Answers only with a sentence that contains every word of the question; without
    // one, it admits it does not know, instead of answering a similar question
    const covers = best.points > 0 && best.points === wanted.size;
    const text = covers ? `${best.sentence} (${best.document})` : DONT_KNOW;
    return { text, inputTokens: tokens(prompt), outputTokens: tokens(text) };
  }
}
