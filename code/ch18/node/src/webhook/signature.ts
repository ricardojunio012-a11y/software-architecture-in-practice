// Signature in the Standard Webhooks format: HMAC-SHA256 of "id.timestamp.body", with
// the secret in base64 after the whsec_ prefix, and the result in base64 after "v1,".
import { createHmac, timingSafeEqual } from "node:crypto";

export function sign(secret: string, id: string, ts: number, body: string) {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const hmac = createHmac("sha256", key).update(`${id}.${ts}.${body}`);
  return `v1,${hmac.digest("base64")}`;
}

// The header can carry several signatures separated by spaces (during a secret
// rotation, the sender signs with the old one and the new one). The constant-time
// comparison does not reveal, through the response time, how many characters match.
export function signatureMatches(
  secret: string,
  id: string,
  ts: number,
  body: string,
  header: string,
): boolean {
  const expected = Buffer.from(sign(secret, id, ts, body));
  return header.split(" ").some((received) => {
    const bytes = Buffer.from(received);
    return bytes.length === expected.length && timingSafeEqual(bytes, expected);
  });
}
