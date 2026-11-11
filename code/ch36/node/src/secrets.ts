// Secrets out of the code: the scan, the secret read from the vault, and the rotation.
// Usage: node src/secrets.ts /data
import { mkdirSync, writeFileSync } from "node:fs";
import { createApi } from "./api.ts";
import { tokenVerifier } from "./identity.ts";
import { call, ISSUER, readSecret, start, clientToken } from "./keycloak.ts";
import { scanFolder } from "./scan.ts";

const lines: string[] = [];
const write = (s = "") => (console.log(s), lines.push(s));
const api = createApi("fixed", tokenVerifier(ISSUER));
const base = await start(api);

write("1. secret scan of the code");
for (const folder of ["before", "after"]) {
  const findings = scanFolder(`examples/${folder}`, "examples");
  write(`   examples/${folder}: ${findings.length} finding(s)`);
  for (const f of findings) {
    write(`     ${f.file}:${f.line} ${f.rule} ${f.sample}`);
  }
}

write("2. the management company's integration, with the secret read from the vault");
const environment = Object.keys(process.env).filter((k) => /SECRET|PASSWORD/i.test(k));
write(`   environment variables with secrets: ${environment.length}`);
const previous = readSecret("integration");
const t1 = await clientToken("integration-mc1", previous);
write(`   token with the secret from the vault: ${t1.status}`);
let r = await call(base, "/v1/communities/C-01/invoices", t1.token);
write(`   invoices of C-01 (managed by MC-1): ${r.status}, ${r.body.length}`);
r = await call(base, "/v1/communities/C-02/invoices", t1.token);
write(`   invoices of C-02 (another management company): ${r.status}`);
const leaked = "mc1-integration-2026-secret"; // the value that was in examples/before
const t0 = await clientToken("integration-mc1", leaked);
write(`   token with the secret that was in the code: ${t0.status} ${t0.error}`);

write("3. secret rotation through the Keycloak admin API");
const rot = await clientToken("morada-rotation", readSecret("rotation"));
const admin = ISSUER.replace("/realms/", "/admin/realms/");
const headers = { authorization: `Bearer ${rot.token}` };
const clients = (await (
  await fetch(`${admin}/clients?clientId=integration-mc1`, { headers })
).json()) as { id: string }[];
const fresh = (await (
  await fetch(`${admin}/clients/${clients[0].id}/client-secret`, {
    method: "POST",
    headers,
  })
).json()) as { value: string };
writeFileSync("/run/secrets/integration", fresh.value); // the vault stores the new one
write(`   new secret generated and stored in the vault: ${fresh.value !== previous}`);
const old = await clientToken("integration-mc1", previous);
write(`   token with the old secret: ${old.status} ${old.error}`);
const t2 = await clientToken("integration-mc1", readSecret("integration"));
write(`   token with the new secret: ${t2.status}`);
r = await call(base, "/v1/communities/C-01/invoices", t1.token);
const note = "(valid until it expires)";
write(`   token issued BEFORE the rotation, at the API: ${r.status} ${note}`);

api.close();
mkdirSync(`${process.argv[2]}/output/secrets`, { recursive: true });
writeFileSync(`${process.argv[2]}/output/secrets/result.txt`, lines.join("\n") + "\n");
