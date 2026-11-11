// The "manifests" version: checks whether the manifests in k8s/ match each other
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { check, config, readManifests } from "./manifests.ts";

const data = process.argv[2] ?? "/data";
const m = readManifests(join(data, "k8s"));
const rules = check(m);
const cfg = config(m);
const out = [
  `${m.size} objects read from k8s/:`,
  "  " + [...m.keys()].map((k) => k.split("/")[0]).join(", "),
  "",
  ...rules.map((r) => `${r.ok ? "ok    " : "FAILED"} ${r.rule} (${r.detail})`),
  "",
  `for the simulation: ${cfg.cpuPerPod}m per replica, ${cfg.min} to ${cfg.max} ` +
    `replicas, target ${cfg.target}%,`,
  `scale-down window ${cfg.scaleDownWindow} s`,
];
const folder = join(data, "output", "manifests");
mkdirSync(folder, { recursive: true });
writeFileSync(join(folder, "result.txt"), out.join("\n") + "\n");
console.log(out.join("\n"));
if (rules.some((r) => !r.ok)) process.exitCode = 1;
