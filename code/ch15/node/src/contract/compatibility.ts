// Compares the published contract with a proposal and lists the changes.
// Incompatible is whatever can break a client that already works: removing something
// it uses, changing what it receives or requiring something it does not send.
import { resolve, type Node } from "./openapi.ts";

export interface Change {
  compatible: boolean;
  text: string;
}

type Side = "request" | "response";

class Comparison {
  changes: Change[] = [];
  old: Node;
  new: Node;

  constructor(old: Node, proposed: Node) {
    this.old = old;
    this.new = proposed;
  }

  note(compatible: boolean, text: string) {
    this.changes.push({ compatible, text });
  }

  schemas(a: Node, b: Node, side: Side, label: string, field: string) {
    a = resolve(this.old, a);
    b = resolve(this.new, b);
    const name = field || "(root)";
    const typeA = [a.type].flat().join(" or ");
    const typeB = [b.type].flat().join(" or ");
    if (typeA !== typeB) {
      const changed = `${name} (${typeA} → ${typeB})`;
      return this.note(false, `${label}: type changed: ${changed}`);
    }
    if (a.enum && b.enum) {
      // A new value in the response breaks whoever handles every case; a value
      // fewer in the request breaks whoever sends it
      const [from, to, warning] =
        side === "response"
          ? [a.enum, b.enum, "new enum value"]
          : [b.enum, a.enum, "enum value removed"];
      for (const value of to) {
        if (!from.includes(value))
          this.note(false, `${label}: ${warning}: ${name} = ${value}`);
      }
    }
    const propsA = a.properties ?? {};
    const propsB = b.properties ?? {};
    const reqA: string[] = a.required ?? [];
    const reqB: string[] = b.required ?? [];
    const inside = (p: string) => (field ? `${field}.${p}` : p);
    for (const p of Object.keys(propsA)) {
      if (!(p in propsB)) {
        this.note(false, `${label}: field removed: ${inside(p)}`);
        continue;
      }
      if (side === "response" && reqA.includes(p) && !reqB.includes(p)) {
        this.note(false, `${label}: field no longer guaranteed: ${inside(p)}`);
      }
      if (side === "request" && !reqA.includes(p) && reqB.includes(p)) {
        this.note(false, `${label}: field became required: ${inside(p)}`);
      }
      this.schemas(propsA[p], propsB[p], side, label, inside(p));
    }
    for (const p of Object.keys(propsB)) {
      if (p in propsA) continue;
      if (side === "response") this.note(true, `${label}: new field: ${inside(p)}`);
      else if (reqB.includes(p)) {
        this.note(false, `${label}: new required field: ${inside(p)}`);
      } else this.note(true, `${label}: new optional field: ${inside(p)}`);
    }
    if (a.items && b.items) this.schemas(a.items, b.items, side, label, `${field}[]`);
  }

  parameters(a: Node[] = [], b: Node[] = [], name: string) {
    const key = (p: Node) => `${p.in} ${p.name}`;
    const added = new Map(b.map((p) => [key(p), p]));
    for (const pa of a) {
      const pb = added.get(key(pa));
      if (!pb) {
        this.note(false, `${name}: parameter removed: ${pa.name}`);
        continue;
      }
      if (!pa.required && pb.required) {
        this.note(false, `${name}: parameter became required: ${pa.name}`);
      }
      const label = `${name} parameter ${pa.name}`;
      this.schemas(pa.schema, pb.schema, "request", label, "");
    }
    const existing = new Set(a.map(key));
    for (const pb of b) {
      if (existing.has(key(pb))) continue;
      if (pb.required) this.note(false, `${name}: new required parameter: ${pb.name}`);
      else this.note(true, `${name}: new optional parameter: ${pb.name}`);
    }
  }

  operation(a: Node, b: Node, name: string) {
    this.parameters(a.parameters, b.parameters, name);
    const requestA = a.requestBody?.content?.["application/json"]?.schema;
    const requestB = b.requestBody?.content?.["application/json"]?.schema;
    if (requestA && requestB)
      this.schemas(requestA, requestB, "request", `${name} request`, "");
    for (const [status, responseA] of Object.entries(a.responses)) {
      const contentA = resolve(this.old, responseA).content ?? {};
      const responseB = b.responses[status];
      if (!responseB) continue;
      const contentB = resolve(this.new, responseB).content ?? {};
      for (const [type, media] of Object.entries<Node>(contentA)) {
        if (!contentB[type]) continue;
        const schemaB = contentB[type].schema;
        this.schemas(media.schema, schemaB, "response", `${name} ${status}`, "");
      }
    }
  }
}

export function compareContracts(old: Node, proposed: Node): Change[] {
  const c = new Comparison(old, proposed);
  for (const [path, operations] of Object.entries<Node>(old.paths)) {
    for (const [method, op] of Object.entries<Node>(operations)) {
      const name = `${method.toUpperCase()} ${path}`;
      const newOp = proposed.paths[path]?.[method];
      if (newOp) c.operation(op, newOp, name);
      else c.note(false, `${name}: operation removed`);
    }
  }
  for (const [path, operations] of Object.entries<Node>(proposed.paths)) {
    for (const method of Object.keys(operations)) {
      if (!old.paths[path]?.[method]) {
        c.note(true, `${method.toUpperCase()} ${path}: new operation`);
      }
    }
  }
  return c.changes;
}
