import { expect, it } from "vitest";
import { pickNode, type Node } from "../src/scheduler.ts";

const node = (name: string, requested: number, ready = true): Node => ({
  name,
  cpu: 1600,
  requested,
  ready,
});

it("filters the nodes where the request fits and prefers the most room", () => {
  const nodes = [node("node-01", 1500), node("node-02", 500), node("node-03", 1000)];
  expect(pickNode(nodes, 500)?.name).toBe("node-02");
  expect(pickNode([node("node-01", 1500)], 500)).toBeUndefined(); // stays Pending
});

it("ignores nodes that are not ready yet and breaks ties by name", () => {
  const notReady = [node("node-02", 0), node("node-01", 0, false)];
  expect(pickNode(notReady, 500)?.name).toBe("node-02");
  expect(pickNode([node("node-02", 0), node("node-01", 0)], 500)?.name).toBe("node-01");
});
