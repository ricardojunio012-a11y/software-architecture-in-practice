// Morada's cost model: given the number of communities and the architecture,
// returns the lines of one month's cost of goods sold (COGS), in dollars.
import { HOURS_PER_MONTH, v } from "./inputs.ts";

export type Architecture = "pool" | "cells" | "silos";

export const ARCHITECTURES: [Architecture, string][] = [
  ["pool", "modular monolith, one database for all"],
  ["cells", "cells of up to 3,000 communities"],
  ["silos", "pool and one silo per large management company"],
];

export type Kind = "infra" | "people";
export type Behavior = "fixed" | "linear" | "step";
export type Tag = "shared" | "assistant" | "support";

export interface Line {
  name: string;
  kind: Kind;
  behavior: Behavior;
  tag: Tag;
  value: number;
}

// A complete installation: application nodes and a database of its own
interface Installation {
  communities: number;
}

const perHour = (price: number) => price * HOURS_PER_MONTH;

// The database doubles in size (and in price) at each step: large, xlarge, 2xlarge...
export function databaseMultiplier(communities: number): number {
  let m = 1;
  while (communities > v("perDatabase") * m) m *= 2;
  return m;
}

export const installationNodes = (communities: number) =>
  Math.max(2, Math.ceil(communities / v("perNode")));

export function installations(arch: Architecture, total: number): Installation[] {
  if (arch === "pool") return [{ communities: total }];
  if (arch === "cells") {
    const n = Math.ceil(total / v("perCell"));
    return Array.from({ length: n }, () => ({ communities: total / n }));
  }
  // silos: the management companies that require isolation get one installation each
  const isolated = Math.round(total * v("isolated"));
  const silos = Math.ceil(isolated / v("perSilo"));
  const list = [{ communities: total - isolated }];
  for (let i = 0; i < silos; i++) {
    const rest = isolated - i * v("perSilo");
    list.push({ communities: Math.min(v("perSilo"), rest) });
  }
  return list;
}

// The COGS lines of one month. Each line declares how it grows: fixed, in line
// with the communities, or in steps (one node, one database, one person at a time).
export function monthlyCost(arch: Architecture, total: number): Line[] {
  const inst = installations(arch, total);
  const sum = (f: (i: Installation) => number) => inst.reduce((s, i) => s + f(i), 0);
  const gb = total * v("data");
  const people = (n: number) => n * v("person");
  const line = (
    name: string,
    kind: Kind,
    behavior: Behavior,
    value: number,
    tag: Tag = "shared",
  ): Line => ({ name, kind, behavior, tag, value });

  const lines = [
    line("control plane", "infra", "fixed", perHour(v("cluster"))),
    line(
      "application nodes",
      "infra",
      "step",
      sum((i) => installationNodes(i.communities) * perHour(v("node"))),
    ),
    line(
      "databases",
      "infra",
      "step",
      sum((i) => databaseMultiplier(i.communities) * perHour(v("database"))),
    ),
    line("disk", "infra", "linear", gb * v("disk")),
    line("backup", "infra", "linear", gb * v("backup")),
    line(
      "logs and traces",
      "infra",
      "linear",
      ((total * v("requests")) / 1e6) * v("signals"),
    ),
    line("assistant", "infra", "linear", total * v("ai"), "assistant"),
    line("secrets vault", "infra", "fixed", v("secrets")),
    line(
      "database operations",
      "people",
      "step",
      inst.length * (v("dbHours") * v("hour") + v("drill")),
    ),
    line(
      "installation operations",
      "people",
      "step",
      inst.length * v("installHours") * v("hour"),
    ),
    line(
      "platform",
      "people",
      "step",
      people(Math.ceil(inst.length / v("perPlatform"))),
    ),
    line("Keycloak", "people", "fixed", people(v("keycloak"))),
    line(
      "support",
      "people",
      "step",
      people(Math.ceil(total / v("perAgent"))),
      "support",
    ),
  ];
  // The cells need a router at the entrance (chapter 17)
  if (arch === "cells") {
    lines.splice(3, 0, line("router", "infra", "fixed", 2 * perHour(v("node"))));
  }
  return lines;
}

export const total = (lines: Line[], kind?: Kind) =>
  lines.filter((l) => !kind || l.kind === kind).reduce((s, l) => s + l.value, 0);
