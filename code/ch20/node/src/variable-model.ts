// A model that imitates the variation of a real language model. It uses the
// extractive model and, through a draw with a fixed seed, sometimes changes the form of
// the answer (the same content, written another way) and sometimes slips: instead of
// admitting it does not know, it answers with the most similar chunk. The seed makes
// the output repeatable.
import type { Chunk } from "./knowledge-base.ts";
import {
  DONT_KNOW,
  ExtractiveModel,
  sentences,
  type Model,
  type Response,
} from "./model.ts";
import { tokens } from "./text.ts";

// A small pseudorandom generator (mulberry32): the same seed, the same sequence
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The same content in another form, as a real model would write it
export const rephrase = (text: string) =>
  text
    .replace(/(\d+) ([ap])\.m\./g, (_, h, x) => `${h}:00 ${x.toUpperCase()}M`)
    .replace(/\$(\d+)\.00/g, "$1 dollars")
    .replace(/\bfour\b/g, "4")
    .replace(/\bsix\b/g, "6");

export class VariableModel implements Model {
  readonly #base = new ExtractiveModel();
  readonly #draw: () => number;

  constructor(seed: number) {
    this.#draw = seededRandom(seed);
  }

  answer(instructions: string, question: string, chunks: Chunk[]): Response {
    const r = this.#base.answer(instructions, question, chunks);
    const draw = this.#draw();
    let text = r.text;
    if (text === DONT_KNOW && chunks.length > 0 && draw < 0.25) {
      // The slip: it answers a similar question, with full confidence
      const sentence = sentences(chunks[0].text)[0];
      text = `${sentence} (${chunks[0].document})`;
    } else if (text !== DONT_KNOW && draw < 0.4) {
      text = rephrase(text);
    }
    return { ...r, text, outputTokens: tokens(text) };
  }
}
