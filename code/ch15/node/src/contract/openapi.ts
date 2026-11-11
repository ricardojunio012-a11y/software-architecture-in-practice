// Reading the OpenAPI contract: resolves references and finds the operation for a
// request.
import fs from "node:fs";
import { parse } from "yaml";

// The contract and the schemas are generic objects, read from the YAML
export type Node = any;

export const readContract = (file: string): Node =>
  parse(fs.readFileSync(file, "utf8"));

// Replaces {"$ref": "#/components/schemas/X"} with the object it points to
export function resolve(contract: Node, node: Node): Node {
  while (node?.$ref) {
    const parts = node.$ref.slice(2).split("/");
    node = parts.reduce((current: Node, part: string) => current[part], contract);
  }
  return node;
}

// The contract's path template that matches a concrete path
export function findPath(contract: Node, path: string): string | undefined {
  const parts = path.split("/");
  return Object.keys(contract.paths).find((template) => {
    const pieces = template.split("/");
    return (
      pieces.length === parts.length &&
      pieces.every((p, i) => p.startsWith("{") || p === parts[i])
    );
  });
}
