// The proxy in front of the legacy. Every request from Beta's app goes through it,
// and a table of rules decides, per route and per property, who answers.
import { call, parts, type Handler, type Response } from "./http.ts";

export type Target = "legacy" | "morada" | "shadow" | "off";
export type Rule = { route: string; properties?: string[]; target: Target };

// "GET /properties/P0101/assessments?period=10/2026" is the route "GET assessments"
export function routeOf(method: string, path: string): string {
  const { seg } = parts(path);
  if (seg[0] === "reports") return `${method} ${seg[1]}`;
  return `${method} ${seg[4] ?? seg[2]}`;
}

export type Divergence = { key: string; kind: string };
export type Count = Map<string, number>;

export class BetaProxy {
  rules: Rule[] = [];
  calls: Count = new Map(); // "route|target|property" -> calls
  comparisons = 0;
  matches = 0;
  divergences: (Divergence & { route: string })[] = [];

  legacy: string;
  next: Handler; // the compatibility layer over Morada

  constructor(legacy: string, next: Handler) {
    this.legacy = legacy;
    this.next = next;
  }

  target(route: string, property: string): Target {
    const r = this.rules.find(
      (r) => r.route === route && (!r.properties || r.properties.includes(property)),
    );
    return r?.target ?? "legacy";
  }

  handle: Handler = async (method, path, body) => {
    const route = routeOf(method, path);
    const property = parts(path).seg[1] ?? "-";
    const target = this.target(route, property);
    const key = `${route}|${target}|${property}`;
    this.calls.set(key, (this.calls.get(key) ?? 0) + 1);

    if (target === "off")
      return { status: 410, body: { error: "ROUTE OFF", use: "Morada reports" } };
    if (target === "morada") return this.next(method, path, body);
    const old = await call(this.legacy, method, path, body);
    if (target === "shadow") await this.experiment(route, method, path, body, old);
    return old; // in shadow mode, the legacy always answers the app
  };

  // Parallel run: the new side runs with the same request, and the difference is
  // recorded. Reads are compared; writes that succeeded in the legacy are repeated in
  // Morada (interception), so that the copy stays the same.
  private async experiment(
    route: string,
    method: string,
    path: string,
    body: unknown,
    old: Response,
  ): Promise<void> {
    if (method === "POST" && old.status !== 200) return;
    const fresh = await this.next(method, path, body);
    this.comparisons++;
    const diffs =
      method === "POST"
        ? fresh.status === old.status
          ? []
          : [{ key: parts(path).seg[3], kind: "write refused" }]
        : compare(old.body as Item[], fresh.body as Item[]);
    if (diffs.length === 0) this.matches++;
    const property = parts(path).seg[1];
    for (const d of diffs)
      this.divergences.push({ ...d, key: `${property}/${d.key}`, route });
  }
}

type Item = Record<string, unknown> & { apt: string; period?: string };

// Compares two lists of Beta's contract, item by item, and classifies the difference
export function compare(old: Item[], fresh: Item[]): Divergence[] {
  const key = (i: Item) => (i.period ? `${i.apt} ${i.period}` : i.apt);
  const map = new Map(fresh.map((i) => [key(i), i]));
  const diffs: Divergence[] = [];
  for (const o of old) {
    const f = map.get(key(o));
    map.delete(key(o));
    if (!f) diffs.push({ key: key(o), kind: "missing in Morada" });
    else if (JSON.stringify(o) !== JSON.stringify(f))
      diffs.push({ key: key(o), kind: kindOfDifference(o, f) });
  }
  for (const k of map.keys()) diffs.push({ key: k, kind: "extra in Morada" });
  return diffs;
}

// Up to 2 cents in the amount, and nothing else different: rounding, which the ADR
// accepts
function kindOfDifference(o: Item, f: Item): string {
  const field = "amount" in o ? "amount" : "total";
  const cents = (x: unknown) => Number(String(x).replace(/\D/g, ""));
  const rest = (i: Item) => JSON.stringify({ ...i, [field]: null });
  const delta = Math.abs(cents(o[field]) - cents(f[field]));
  if (rest(o) === rest(f) && delta <= 2) return "rounding (accepted)";
  return "different";
}
