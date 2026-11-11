// Authenticated encryption (AES-256-GCM) with one key per consumer.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export const newKey = (): Buffer => randomBytes(32);

export function encrypt(key: Buffer, text: string): string {
  const iv = randomBytes(12); // a new vector for every encryption
  const c = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64")).join(".");
}

export function decrypt(key: Buffer, encrypted: string): string {
  const [iv, tag, body] = encrypted.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag); // wrong key or tampered data: final() throws
  return Buffer.concat([d.update(body), d.final()]).toString("utf8");
}

// Envelope: the consumer's key is stored encrypted with the master key.
export const wrap = (master: Buffer, key: Buffer): string =>
  encrypt(master, key.toString("base64"));

export const unwrap = (master: Buffer, envelope: string): Buffer =>
  Buffer.from(decrypt(master, envelope), "base64");
