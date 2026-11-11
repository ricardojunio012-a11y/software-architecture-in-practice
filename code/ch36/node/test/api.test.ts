// The API against tokens signed by a key generated in the test: no Keycloak.
import type { AddressInfo } from "node:net";
import { exportJWK, generateKeyPair, SignJWT, createLocalJWKSet } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApi } from "../src/api.ts";
import { people } from "../src/data.ts";
import { tokenVerifier } from "../src/identity.ts";

const ISSUER = "http://issuer.test/realms/morada";
let sign: (sub: string, roles: string[], aud?: string) => Promise<string>;
let base = "";
const api = { idor: "", fixed: "" };
const servers: ReturnType<typeof createApi>[] = [];

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" };
  const keys = createLocalJWKSet({ keys: [jwk] });
  sign = (sub, roles, aud = "morada-api") =>
    new SignJWT({ realm_access: { roles }, azp: "morada-app" })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(ISSUER)
      .setAudience(aud)
      .setSubject(sub)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
  for (const mode of ["idor", "fixed"] as const) {
    const s = createApi(mode, tokenVerifier(ISSUER, keys));
    servers.push(s);
    await new Promise<void>((ok) => s.listen(0, "127.0.0.1", ok));
    api[mode] = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
  }
  base = api.fixed;
});
afterAll(() => servers.forEach((s) => s.close()));

const get = async (url: string, token?: string) =>
  (await fetch(url, { headers: token ? { authorization: `Bearer ${token}` } : {} }))
    .status;

describe("invoices API", () => {
  it("no token, 401; token for another audience, 401", async () => {
    expect(await get(`${base}/v1/invoices/INV-1001`)).toBe(401);
    const other = await sign(people.anna, ["resident"], "other-api");
    expect(await get(`${base}/v1/invoices/INV-1001`, other)).toBe(401);
  });

  it("the IDOR: in idor mode, anna reads another community's invoice", async () => {
    const anna = await sign(people.anna, ["resident"]);
    expect(await get(`${api.idor}/v1/invoices/INV-1005`, anna)).toBe(200);
    expect(await get(`${api.fixed}/v1/invoices/INV-1005`, anna)).toBe(404);
    expect(await get(`${api.fixed}/v1/invoices/INV-1001`, anna)).toBe(200);
  });

  it("the right role is not enough: C-01's president cannot list C-02", async () => {
    const brian = await sign(people.brian, ["board_president"]);
    expect(await get(`${base}/v1/communities/C-01/invoices`, brian)).toBe(200);
    expect(await get(`${base}/v1/communities/C-02/invoices`, brian)).toBe(404);
  });

  it("a role without access to the function gets 403", async () => {
    const carol = await sign(people.carol, ["front_desk"]);
    expect(await get(`${base}/v1/invoices/INV-1001`, carol)).toBe(403);
  });
});
