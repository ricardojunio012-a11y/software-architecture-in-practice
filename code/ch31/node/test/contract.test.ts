// Contract tests for the ports: the same suite runs against the in-memory
// adapters and against the AWS ones (on LocalStack). If one adapter promises what
// the other does not deliver, this is where it shows.
import { beforeAll, describe, expect, it } from "vitest";
import { awsCloud } from "../src/aws.ts";
import { createClients } from "../src/clients.ts";
import { destroy, names, provision } from "../src/infra.ts";
import { inMemoryCloud } from "../src/memory.ts";
import type { Cloud } from "../src/ports.ts";

const factories: [string, () => Promise<Cloud>][] = [
  ["in memory", async () => inMemoryCloud()],
  [
    "AWS on LocalStack",
    async () => {
      const c = createClients();
      const n = names("contract");
      await destroy(c, n);
      await provision(c, n);
      return awsCloud(c, n);
    },
  ],
];

describe.each(factories)("the ports, %s", (_, factory) => {
  let cloud: Cloud;
  beforeAll(async () => {
    cloud = await factory();
  }, 60_000);

  it("stores and reads a file; a missing path returns undefined", async () => {
    const content = new TextEncoder().encode("%PDF-1.7 test");
    await cloud.files.store("t/1.pdf", content, "application/pdf");
    expect(await cloud.files.read("t/1.pdf")).toEqual(content);
    expect(await cloud.files.read("t/missing.pdf")).toBeUndefined();
  });

  it("registers a document only once and reads it right after", async () => {
    const d = { community: "201", month: "2026-10", path: "x", bytes: 10 };
    expect(await cloud.documents.registerIfNew(d)).toBe(true);
    expect(await cloud.documents.registerIfNew({ ...d, bytes: 99 })).toBe(false);
    expect(await cloud.documents.forCommunity("201")).toEqual([d]);
  });

  it("delivers the task and does not repeat it once acked", async () => {
    const task = { type: "notify-residents" as const, community: "301", month: "x" };
    await cloud.tasks.publish(task);
    const [received] = await cloud.tasks.receive(10);
    expect(received.task).toEqual(task);
    await cloud.tasks.ack(received);
    expect(await cloud.tasks.receive(10)).toEqual([]);
  });
});
