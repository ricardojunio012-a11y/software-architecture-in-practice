// Per-consumer encryption and the chained trail, without a database.
import { describe, expect, it } from "vitest";
import { decrypt, encrypt, newKey } from "../src/crypto.ts";
import { chain, type Entry, verify } from "../src/trail.ts";

describe("crypto-shredding", () => {
  it("decrypts with the consumer's key", () => {
    const key = newKey();
    expect(decrypt(key, encrypt(key, "Charles Mitchell"))).toBe("Charles Mitchell");
  });

  it("the same text encrypted twice gives different results", () => {
    const key = newKey();
    expect(encrypt(key, "302")).not.toBe(encrypt(key, "302"));
  });

  it("without the right key, the data is unreadable", () => {
    const encrypted = encrypt(newKey(), "916-18-0339");
    expect(() => decrypt(newKey(), encrypted)).toThrow();
  });
});

describe("chained trail", () => {
  const build = (n: number) => {
    const trail: Entry[] = [];
    for (let i = 1; i <= n; i++)
      trail.push(
        chain(trail.at(-1), {
          time: `2026-10-20T0${i}:00`,
          actor: "president.anna",
          action: "viewed",
          target: `consumer:${i}`,
        }),
      );
    return trail;
  };

  it("a trail without changes is intact", () => {
    const trail = build(5);
    expect(verify(trail, { seq: 5, hash: trail[4].hash })).toEqual([]);
  });

  it("flags a changed entry", () => {
    const trail = build(5);
    trail[2] = { ...trail[2], actor: "system" };
    expect(verify(trail)).toEqual(["entry 3: content changed after it was written"]);
  });

  it("flags an entry deleted in the middle", () => {
    const trail = build(5);
    trail.splice(1, 1);
    expect(verify(trail)).toEqual([
      "entry 3: broken link, the previous hash does not match",
    ]);
  });

  it("only the anchor flags the cut end", () => {
    const trail = build(5);
    const anchor = { seq: 5, hash: trail[4].hash };
    const cut = trail.slice(0, 3);
    expect(verify(cut)).toEqual([]);
    expect(verify(cut, anchor)).toEqual([
      "anchor at entry 5: missing (the trail ends at 3)",
    ]);
  });
});
