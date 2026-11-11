// Calls to Keycloak used by the lab scripts.
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

export const ISSUER = process.env.ISSUER ?? "http://keycloak:8080/realms/morada";
const TOKEN_URL = `${ISSUER}/protocol/openid-connect/token`;

export const readSecret = (name: string) =>
  readFileSync(`/run/secrets/${name}`, "utf8").trim();

async function requestToken(fields: Record<string, string>) {
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    body: new URLSearchParams(fields),
  });
  const body = (await r.json()) as { access_token?: string; error?: string };
  return { status: r.status, token: body.access_token, error: body.error };
}

// Lab only: a person's login without a browser (Direct Access Grant).
// In production: authorization code with PKCE, through the BFF (chapter 13).
export async function logIn(user: string) {
  const r = await requestToken({
    grant_type: "password",
    client_id: "morada-app",
    username: user,
    password: readSecret("user_password"),
    scope: "openid",
  });
  if (!r.token) throw new Error(`login of ${user} failed: ${r.error}`);
  return r.token;
}

// System to system: client credentials (RFC 6749, section 4.4)
export const clientToken = (clientId: string, secret: string) =>
  requestToken({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: secret,
  });

export function readClaims(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
}

export async function start(api: Server): Promise<string> {
  await new Promise<void>((ok) => api.listen(0, "127.0.0.1", ok));
  return `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
}

export async function call(base: string, path: string, token?: string) {
  const headers: Record<string, string> = token
    ? { authorization: `Bearer ${token}` }
    : {};
  const r = await fetch(base + path, { headers });
  return { status: r.status, body: (await r.json()) as any };
}
