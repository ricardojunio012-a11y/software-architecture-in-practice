// A simplified, deterministic vector representation (embedding): each relevant word
// lands in one of 256 positions, through a hash, and the vector is normalized. A real
// embedding model captures synonyms and context; this one captures only shared
// words, which is enough to show the architecture with an output that does not change
// from one run to the next.
const STOP_WORDS = new Set(
  [
    "a an the of in on at to for by with and or is are be do does did i my me it its",
    "what which who how much many can could may should was were from about that this",
    "s m p",
  ]
    .join(" ")
    .split(" "),
);
export const DIMENSIONS = 256;
const ACCENTS = /\p{M}/gu; // the accent marks that NFD separates from the letters

export function words(text: string): string[] {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(ACCENTS, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w && !STOP_WORDS.has(w))
      // A crude stem: the first five characters (reserve, reservation)
      .map((w) => w.slice(0, 5))
  );
}

function hash(word: string): number {
  let h = 2166136261;
  for (const c of word) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) % DIMENSIONS;
}

export function embed(text: string): number[] {
  const v = new Array(DIMENSIONS).fill(0);
  for (const w of words(text)) v[hash(w)] += 1;
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => Number((x / norm).toFixed(6)));
}

// Tokens, to estimate cost: about four characters per token
export const tokens = (text: string) => Math.ceil(text.length / 4);
