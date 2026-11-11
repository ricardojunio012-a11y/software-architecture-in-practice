import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { check, millicpu, readManifests } from "../src/manifests.ts";

// In the container, k8s/ is at /data/k8s; outside it, next to the node/ folder
const folder = existsSync("/data/k8s")
  ? "/data/k8s"
  : fileURLToPath(new URL("../../k8s", import.meta.url));
const base = () => readManifests(folder);
const failures = (m: ReturnType<typeof base>) =>
  check(m)
    .filter((r) => !r.ok)
    .map((r) => r.rule);

describe("the manifest check", () => {
  it("approves the chapter's manifests", () => {
    expect(failures(base())).toEqual([]);
  });

  it("flags the CPU-based HPA without a CPU request", () => {
    const m = base();
    delete m.get("Deployment/morada-api")!.spec.template.spec.containers[0].resources
      .requests.cpu;
    expect(failures(m)).toContain(
      "the CPU-based HPA has a CPU request in every container",
    );
  });

  it("flags the Service that does not find the pods and the latest image", () => {
    const m = base();
    m.get("Service/morada-api")!.spec.selector = { app: "morada" };
    m.get("Deployment/morada-api")!.spec.template.spec.containers[0].image =
      "api:latest";
    expect(failures(m)).toEqual([
      "image of api has a fixed tag",
      "Service morada-api finds the pods",
    ]);
  });

  it("flags liveness and readiness on the same path", () => {
    const m = base();
    const c = m.get("Deployment/morada-api")!.spec.template.spec.containers[0];
    c.readinessProbe.httpGet.path = "/health/live";
    expect(failures(m)).toEqual(["api: liveness and readiness are different checks"]);
  });

  it("converts CPU to thousandths of a core", () => {
    expect(millicpu("500m")).toBe(500);
    expect(millicpu("2")).toBe(2000);
  });
});
