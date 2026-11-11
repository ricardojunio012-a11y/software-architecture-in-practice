// Reads the manifests in k8s/ and checks whether they match each other. These are
// rules Kubernetes would accept broken without complaint: the error shows up only in
// production.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseAllDocuments } from "yaml";

type K8sObject = { kind: string; metadata: { name: string }; spec: any };
export type Manifests = Map<string, K8sObject>; // key: "Kind/name"

export function readManifests(folder: string): Manifests {
  const all: Manifests = new Map();
  for (const file of readdirSync(folder)
    .filter((a) => a.endsWith(".yaml"))
    .sort()) {
    for (const doc of parseAllDocuments(readFileSync(join(folder, file), "utf8"))) {
      const o = doc.toJS() as K8sObject;
      if (o) all.set(`${o.kind}/${o.metadata.name}`, o);
    }
  }
  return all;
}

export type Rule = { rule: string; ok: boolean; detail: string };

// Converts "500m" and "1" (CPU) to thousandths of a core
export function millicpu(value: string | number | undefined): number {
  if (value === undefined) return 0;
  const s = String(value);
  return s.endsWith("m") ? Number(s.slice(0, -1)) : Number(s) * 1000;
}

// The rules of the check
export function check(m: Manifests): Rule[] {
  const rules: Rule[] = [];
  const r = (rule: string, ok: boolean, detail: string) =>
    rules.push({ rule, ok, detail });
  const dep = [...m.values()].find((o) => o.kind === "Deployment");
  if (!dep) return [{ rule: "a Deployment exists", ok: false, detail: "none" }];
  const labels = dep.spec.template.metadata.labels ?? {};
  const selects = (sel: Record<string, string> = {}) =>
    Object.keys(sel).length > 0 &&
    Object.entries(sel).every(([k, v]) => labels[k] === v);
  const conts: any[] = dep.spec.template.spec.containers;
  const ports = new Set(conts.flatMap((c) => (c.ports ?? []).map((p: any) => p.name)));

  r(
    "the Deployment selects its own pods",
    selects(dep.spec.selector.matchLabels),
    JSON.stringify(dep.spec.selector.matchLabels),
  );
  for (const c of conts) {
    const tag = String(c.image).split(":")[1];
    r(`image of ${c.name} has a fixed tag`, !!tag && tag !== "latest", c.image);
    r(
      `${c.name} requests CPU and memory`,
      millicpu(c.resources?.requests?.cpu) > 0 && !!c.resources?.requests?.memory,
      JSON.stringify(c.resources?.requests ?? {}),
    );
    r(
      `${c.name} has a memory limit`,
      !!c.resources?.limits?.memory,
      c.resources?.limits?.memory ?? "no limit",
    );
    const live = c.livenessProbe?.httpGet?.path;
    const ready = c.readinessProbe?.httpGet?.path;
    r(
      `${c.name}: liveness and readiness are different checks`,
      !!live && !!ready && live !== ready,
      `${live} and ${ready}`,
    );
    const startup = c.startupProbe
      ? c.startupProbe.periodSeconds * c.startupProbe.failureThreshold
      : 0;
    r(`${c.name}: startup has its own deadline`, startup >= 20, `${startup} s`);
  }
  for (const svc of [...m.values()].filter((o) => o.kind === "Service")) {
    r(
      `Service ${svc.metadata.name} finds the pods`,
      selects(svc.spec.selector),
      JSON.stringify(svc.spec.selector),
    );
    for (const p of svc.spec.ports) {
      const target = p.targetPort;
      r(
        `Service ${svc.metadata.name}: port ${target} exists in the container`,
        typeof target === "number" || ports.has(target),
        String(target),
      );
    }
  }
  for (const route of [...m.values()].filter((o) => o.kind === "HTTPRoute")) {
    for (const b of route.spec.rules.flatMap((x: any) => x.backendRefs)) {
      const svc = m.get(`Service/${b.name}`);
      r(
        `HTTPRoute ${route.metadata.name} points to a Service that exists`,
        !!svc && svc.spec.ports.some((p: any) => p.port === b.port),
        `${b.name}:${b.port}`,
      );
    }
  }
  const hpa = [...m.values()].find((o) => o.kind === "HorizontalPodAutoscaler");
  if (hpa) {
    const target = hpa.spec.scaleTargetRef;
    r(
      "the HPA points to the Deployment",
      target.kind === "Deployment" && target.name === dep.metadata.name,
      target.name,
    );
    const byCpu = hpa.spec.metrics.some((x: any) => x.resource?.name === "cpu");
    r(
      "the CPU-based HPA has a CPU request in every container",
      !byCpu || conts.every((c) => millicpu(c.resources?.requests?.cpu) > 0),
      byCpu ? "cpu metric" : "no CPU metric",
    );
    const pdb = [...m.values()].find((o) => o.kind === "PodDisruptionBudget");
    if (pdb)
      r(
        "the PodDisruptionBudget lets a node be drained",
        pdb.spec.minAvailable < hpa.spec.minReplicas,
        `minAvailable ${pdb.spec.minAvailable}, minReplicas ${hpa.spec.minReplicas}`,
      );
  }
  return rules;
}

// The values the simulation uses, read from the manifests themselves
export type Config = {
  cpuPerPod: number; // thousandths of a core requested per replica
  min: number;
  max: number;
  target: number; // % utilization of the CPU request
  scaleDownWindow: number; // seconds
};

export function config(m: Manifests): Config {
  const dep = [...m.values()].find((o) => o.kind === "Deployment")!;
  const hpa = [...m.values()].find((o) => o.kind === "HorizontalPodAutoscaler")!;
  const cpu = hpa.spec.metrics.find((x: any) => x.resource?.name === "cpu");
  return {
    cpuPerPod: dep.spec.template.spec.containers
      .map((c: any) => millicpu(c.resources?.requests?.cpu))
      .reduce((a: number, b: number) => a + b, 0),
    min: hpa.spec.minReplicas ?? 1,
    max: hpa.spec.maxReplicas,
    target: cpu.resource.target.averageUtilization,
    scaleDownWindow: hpa.spec.behavior?.scaleDown?.stabilizationWindowSeconds ?? 300,
  };
}
