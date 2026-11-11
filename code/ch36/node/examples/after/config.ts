// The same configuration, with the secrets out of the code: what is not secret stays
// here; the secret is read, at run time, from where the vault delivers it.
import { readFileSync } from "node:fs";

const secret = (name: string) => readFileSync(`/run/secrets/${name}`, "utf8").trim();

export const config = {
  issuer: process.env.ISSUER ?? "http://keycloak:8080/realms/morada",
  clientId: "integration-mc1",
  clientSecret: () => secret("integration"), // read on each use: no deploy to rotate
  database: () => `postgresql://morada:${secret("db")}@db:5432/morada`,
  // No AWS access key: in the cloud, the application uses the role of its own machine
  // or pod, with temporary credentials, and no fixed key exists
};
