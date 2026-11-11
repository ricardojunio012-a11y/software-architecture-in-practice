// A simulated cluster on a logical clock: every 15 s, it measures the load, runs the
// HPA, creates or deletes replicas, schedules the pending ones and, if a node is
// missing, asks for another.
import { STEP } from "./load.ts";
import { pickNode, type Node } from "./scheduler.ts";
import { HpaController } from "./hpa.ts";
import type { Config } from "./manifests.ts";

// Premises of the lab (not a provider's numbers)
export const PREMISES = {
  requestsPerPod: 50, // requests/s of one replica at 100% of the CPU request
  usageCeiling: 160, // % of the CPU request a replica reaches, with no CPU limit
  nodeCpu: 1600, // free millicpu for the application on a 2-vCPU node
  pullImage: 30, // s for a new node to pull the image (once per node)
  startup: 30, // s from process start until readiness answers
  nodeStartup: 120, // s for a new node to join the cluster
  nodeIdle: 600, // s a node stays empty before it is given back
  minNodes: 1,
  maxNodes: 12,
};

type Pod = { name: string; created: number; node?: string; ready?: number };
type SimNode = Node & {
  created: number;
  readyAt: number;
  imageAt?: number;
  empty?: number;
};

export type Scenario = {
  name: string;
  fixed?: number | ((t: number) => number); // no HPA: fixed or planned replicas
  min?: (t: number) => number; // with HPA: a minimum that changes with the time
};

export type Row = {
  t: number;
  load: number;
  desired: number;
  ready: number;
  pending: number;
  nodes: number;
  usage: number;
  slow: number;
  lost: number;
};

export type Result = {
  requests: number;
  slow: number;
  lost: number;
  maxReady: number;
  maxNodes: number;
  nodeSeconds: number;
  podSeconds: number;
  rows: Row[];
};

export function simulate(cfg: Config, load: number[], c: Scenario): Result {
  const p = PREMISES;
  const hpa = new HpaController(cfg);
  const nodes: SimNode[] = [];
  let pods: Pod[] = [];
  let podCount = 0;
  let nodeCount = 0;
  const newNode = (t: number, ready: boolean) => {
    const name = `node-${String(++nodeCount).padStart(2, "0")}`;
    const readyAt = ready ? t : t + p.nodeStartup;
    nodes.push({
      name,
      cpu: p.nodeCpu,
      requested: 0,
      ready,
      created: t,
      readyAt,
      imageAt: ready ? t : undefined,
    });
  };
  const newPod = (t: number) => pods.push({ name: `api-${++podCount}`, created: t });

  // Starts with the initial replicas ready, on ready nodes
  const fixed =
    typeof c.fixed === "function"
      ? c.fixed
      : c.fixed !== undefined
        ? () => c.fixed as number
        : undefined;
  const initial = fixed?.(0) ?? Math.max(cfg.min, c.min?.(0) ?? 0);
  for (let k = 0; k < initial; k++) newPod(-STEP);
  while (nodes.length * Math.floor(p.nodeCpu / cfg.cpuPerPod) < initial)
    newNode(-STEP, true);
  for (const pod of pods) {
    const node = pickNode(nodes, cfg.cpuPerPod)!;
    node.requested += cfg.cpuPerPod;
    pod.node = node.name;
    pod.ready = -STEP;
  }

  const r: Result = {
    requests: 0,
    slow: 0,
    lost: 0,
    maxReady: 0,
    maxNodes: 0,
    nodeSeconds: 0,
    podSeconds: 0,
    rows: [],
  };
  for (let k = 0; k < load.length; k++) {
    const t = k * STEP;
    // 1. nodes and replicas that finished starting
    for (const n of nodes) n.ready = n.readyAt <= t;
    const ready = pods.filter((x) => x.ready !== undefined && x.ready <= t);
    // 2. the load of the moment, split by the Service among the ready replicas
    const requests = load[k];
    const capacity = (ready.length * p.requestsPerPod * p.usageCeiling) / 100;
    const lost = Math.max(0, requests - capacity) * STEP;
    const usage = ready.length
      ? Math.min(p.usageCeiling, (requests / ready.length / p.requestsPerPod) * 100)
      : 0;
    // above 100% of the CPU request, the replica answers, but slowly
    const slow = usage > 100 ? requests * STEP - lost : 0;
    // 3. the HPA (or the fixed number) decides how many replicas should exist
    const desired =
      fixed?.(t) ??
      hpa.cycle(
        t,
        {
          current: pods.length,
          readyUsage: ready.map(() => usage),
          notReady: pods.length - ready.length,
        },
        c.min?.(t),
      );
    // 4. the ReplicaSet creates the missing ones or deletes the extra ones: first
    // those without a node, then those not ready, then the newest
    while (pods.length < desired) newPod(t);
    if (pods.length > desired) {
      const order = [...pods].sort(
        (a, b) =>
          Number(!!a.node) - Number(!!b.node) ||
          Number((a.ready ?? Infinity) <= t) - Number((b.ready ?? Infinity) <= t) ||
          b.created - a.created,
      );
      for (const gone of order.slice(0, pods.length - desired)) {
        const node = nodes.find((n) => n.name === gone.node);
        if (node) node.requested -= cfg.cpuPerPod;
      }
      const leaving = new Set(order.slice(0, pods.length - desired));
      pods = pods.filter((x) => !leaving.has(x));
    }
    // 5. the scheduler places the pending ones, in the order they were created
    for (const pod of pods.filter((x) => !x.node)) {
      const node = pickNode(nodes, cfg.cpuPerPod) as SimNode | undefined;
      if (!node) continue;
      node.requested += cfg.cpuPerPod;
      pod.node = node.name;
      node.imageAt ??= t + p.pullImage; // the node's replicas wait for the same image
      pod.ready = Math.max(t, node.imageAt) + p.startup;
    }
    // 6. the node autoscaler: asks for nodes for the pending pods that do not fit in
    // the ones already starting, and gives back nodes that have been empty too long
    const slotsPerNode = Math.floor(p.nodeCpu / cfg.cpuPerPod);
    const pending = pods.filter((x) => !x.node).length;
    const arriving = nodes.filter((n) => !n.ready).length * slotsPerNode;
    let missing = Math.ceil(Math.max(0, pending - arriving) / slotsPerNode);
    while (missing-- > 0 && nodes.length < p.maxNodes) newNode(t, false);
    for (const n of nodes)
      n.empty = n.requested === 0 && n.ready ? (n.empty ?? t) : undefined;
    const idle = nodes.find((n) => n.empty !== undefined && t - n.empty >= p.nodeIdle);
    if (idle && nodes.length > p.minNodes) nodes.splice(nodes.indexOf(idle), 1);

    r.requests += requests * STEP;
    r.lost += lost;
    r.slow += slow;
    r.maxReady = Math.max(r.maxReady, ready.length);
    r.maxNodes = Math.max(r.maxNodes, nodes.length);
    r.nodeSeconds += nodes.length * STEP; // a node is billed from its request
    r.podSeconds += pods.length * STEP;
    r.rows.push({
      t,
      load: requests,
      desired,
      ready: ready.length,
      pending,
      nodes: nodes.length,
      usage,
      slow,
      lost,
    });
  }
  return r;
}
