// Hash-chained audit trail: each entry stores the hash of the previous one.
import { createHash } from "node:crypto";

export type Entry = {
  seq: number;
  time: string;
  actor: string;
  action: string;
  target: string; // an identifier, never the personal data itself
  previous: string;
  hash: string;
};
export type Anchor = { seq: number; hash: string };
export const GENESIS = "0".repeat(64);

export function computeHash(e: Omit<Entry, "hash">): string {
  const fields = [e.seq, e.time, e.actor, e.action, e.target, e.previous];
  return createHash("sha256").update(JSON.stringify(fields)).digest("hex");
}

export function chain(
  last: Entry | undefined,
  next: Pick<Entry, "time" | "actor" | "action" | "target">,
): Entry {
  const base = {
    ...next,
    seq: (last?.seq ?? 0) + 1,
    previous: last?.hash ?? GENESIS,
  };
  return { ...base, hash: computeHash(base) };
}

export function verify(trail: Entry[], anchor?: Anchor): string[] {
  const problems: string[] = [];
  let previous = GENESIS;
  for (const e of trail) {
    if (e.previous !== previous)
      problems.push(`entry ${e.seq}: broken link, the previous hash does not match`);
    if (computeHash(e) !== e.hash)
      problems.push(`entry ${e.seq}: content changed after it was written`);
    previous = e.hash;
  }
  if (anchor) {
    const e = trail.find((x) => x.seq === anchor.seq);
    const last = trail.at(-1)?.seq ?? 0;
    const at = `anchor at entry ${anchor.seq}`;
    if (!e) problems.push(`${at}: missing (the trail ends at ${last})`);
    else if (e.hash !== anchor.hash)
      problems.push(`${at}: hash differs from the published one`);
  }
  return problems;
}
