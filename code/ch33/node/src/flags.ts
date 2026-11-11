// Feature flags per community. A flag can be off for everyone, on for a list of
// communities, or on for a percentage of them. The percentage is stable: the same
// community always lands on the same side, and going from 10% to 20% only adds
// communities, without removing any.
import { createHash } from "node:crypto";

export type Rule = { on: boolean; communities: number[]; percentage: number };

// A number from 0 to 99, fixed for each (flag, community) pair
export function bucket(flag: string, community: number): number {
  const hash = createHash("sha256").update(`${flag}:${community}`).digest();
  return hash.readUInt32BE(0) % 100;
}

export function isOn(flag: string, rule: Rule, community: number): boolean {
  if (!rule.on) return false; // the main switch overrides everything
  if (rule.communities.includes(community)) return true;
  return bucket(flag, community) < rule.percentage;
}
