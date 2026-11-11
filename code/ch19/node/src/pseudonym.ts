// Pseudonymization: replaces a personal identifier (tax ID, plate) with a code that
// does not reveal the original. It is an HMAC with a key kept outside the analytics
// database: the same tax ID always yields the same code, which lets you count and join
// data per resident, but without the key no one can get back to the tax ID, or test
// candidate tax IDs one by one.
import { createHmac } from "node:crypto";

export function pseudonym(key: string, value: string): string {
  return createHmac("sha256", key).update(value).digest("hex").slice(0, 16);
}

// What must never reach the analytics database in the clear
export const PERSONAL_PATTERNS = {
  "tax ID": /^\d{9}$/,
  plate: /^\d[A-Z]{3}\d{3}$/,
};

export function looksPersonal(value: unknown): string | null {
  if (typeof value !== "string") return null;
  for (const [name, pattern] of Object.entries(PERSONAL_PATTERNS)) {
    if (pattern.test(value)) return name;
  }
  return null;
}
