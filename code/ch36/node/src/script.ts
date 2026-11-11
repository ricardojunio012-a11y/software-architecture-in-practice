// The IDOR script: the same calls against the API in the "idor" and "fixed" modes.
// Usage: node src/script.ts idor|fixed /data
import { mkdirSync, writeFileSync } from "node:fs";
import { createApi, type Mode } from "./api.ts";
import { invoices } from "./data.ts";
import { tokenVerifier } from "./identity.ts";
import { call, ISSUER, logIn, readClaims, start } from "./keycloak.ts";

const mode = process.argv[2] as Mode;
const lines: string[] = [];
const write = (s = "") => (console.log(s), lines.push(s));

const api = createApi(mode, tokenVerifier(ISSUER));
const base = await start(api);
const summary = (r: { status: number; body: any }) =>
  r.status === 200
    ? Array.isArray(r.body)
      ? `200 (${r.body.length} invoices)`
      : `200 (${r.body.id}, unit ${r.body.unit})`
    : `${r.status} ${String(r.body.type).split("/").pop()}`;

write(`== mode: ${mode}`);
write("1. login at Keycloak (OIDC) and roles in the token");
const names = ["anna", "brian", "carol", "dora", "ed"];
const tokens: Record<string, string> = {};
const ROLES = ["board_president", "resident", "front_desk", "management_company"];
for (const name of names) {
  tokens[name] = await logIn(name);
  const c = readClaims(tokens[name]) as any;
  const roles = c.realm_access.roles.filter((r: string) => ROLES.includes(r)).sort();
  write(`   ${name.padEnd(6)} roles: ${roles.join(", ")}`);
}
const c = readClaims(tokens.anna) as any;
const audOk = [c.aud].flat().includes("morada-api");
write(`   anna's token: aud includes morada-api: ${audOk}`);
write(`   lifetime: ${c.exp - c.iat} s`);

write("2. authentication");
write(`   no token, INV-1001: ${summary(await call(base, "/v1/invoices/INV-1001"))}`);
const [header, claims, signature] = tokens.anna.split(".");
const forged = JSON.parse(Buffer.from(claims, "base64url").toString());
forged.realm_access.roles.push("board_president");
const tampered = [
  header,
  Buffer.from(JSON.stringify(forged)).toString("base64url"),
  signature,
];
let r = await call(base, "/v1/invoices/INV-1001", tampered.join("."));
write(`   anna with a forged board_president role in the token: ${summary(r)}`);
const unsigned = [
  Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url"),
  claims,
  "",
].join(".");
r = await call(base, "/v1/invoices/INV-1001", unsigned);
write(`   token with alg "none": ${summary(r)}`);

write("3. authorization by role (RBAC)");
r = await call(base, "/v1/invoices/INV-1001", tokens.anna);
write(`   anna reads the invoice for her own unit: ${summary(r)}`);
r = await call(base, "/v1/invoices/INV-1001", tokens.carol);
write(`   carol (front desk) reads the same invoice: ${summary(r)}`);

write("4. authorization by object (the IDOR)");
r = await call(base, "/v1/invoices/INV-1002", tokens.anna);
write(`   anna reads her neighbor's invoice (102): ${summary(r)}`);
r = await call(base, "/v1/invoices/INV-1005", tokens.anna);
write(`   anna reads an invoice from community C-02: ${summary(r)}`);
r = await call(base, "/v1/communities/C-01/invoices", tokens.ed);
write(`   ed (C-02) lists the invoices of C-01: ${summary(r)}`);

write("5. enumeration: each one tries the 12 invoices, INV-1001 to INV-1012");
for (const name of ["anna", "brian", "dora", "ed"]) {
  const read: string[] = [];
  for (const inv of invoices) {
    if ((await call(base, `/v1/invoices/${inv.id}`, tokens[name])).status === 200) {
      read.push(inv.community);
    }
  }
  const count = String(read.length).padStart(2);
  const communities = [...new Set(read)].join(", ");
  write(`   ${name.padEnd(6)} reads ${count} of 12 (${communities})`);
}

api.close();
mkdirSync(`${process.argv[3]}/output/${mode}`, { recursive: true });
writeFileSync(`${process.argv[3]}/output/${mode}/result.txt`, lines.join("\n") + "\n");
