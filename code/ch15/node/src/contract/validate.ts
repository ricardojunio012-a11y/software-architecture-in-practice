// Checks a real response against the contract: the status must be documented, so
// must the content type, and the body must follow the schema.
import { findPath, resolve, type Node } from "./openapi.ts";

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function validateSchema(
  contract: Node,
  schema: Node,
  value: Node,
  at: string,
): string[] {
  schema = resolve(contract, schema);
  const types = [schema.type].flat();
  const type = typeOf(value);
  if (schema.type && !types.includes(type)) {
    return [`${at}: expected ${types.join(" or ")}, got ${type}`];
  }
  if (schema.enum && !schema.enum.includes(value)) {
    return [`${at}: value not in enum: ${value}`];
  }
  const errors: string[] = [];
  if (type === "object") {
    for (const field of schema.required ?? []) {
      if (!(field in value)) errors.push(`${at}.${field}: required field missing`);
    }
    for (const [field, sub] of Object.entries(schema.properties ?? {})) {
      if (field in value) {
        errors.push(...validateSchema(contract, sub, value[field], `${at}.${field}`));
      }
    }
  }
  if (type === "array" && schema.items) {
    value.forEach((item: Node, i: number) => {
      errors.push(...validateSchema(contract, schema.items, item, `${at}[${i}]`));
    });
  }
  return errors;
}

export function validateResponse(
  contract: Node,
  method: string,
  path: string,
  status: number,
  type: string,
  body: Node,
): string[] {
  const template = findPath(contract, path);
  const operation = template && contract.paths[template][method.toLowerCase()];
  if (!operation) return [`${method} ${path}: operation not in the contract`];
  const name = `${method} ${template} ${status}`;
  const response = resolve(contract, operation.responses[String(status)]);
  if (!response) return [`${name}: status not documented`];
  const content = response.content?.[type];
  if (!content) return [`${name}: content type not documented: ${type}`];
  return validateSchema(contract, content.schema, body, "$").map(
    (e) => `${name}: ${e}`,
  );
}
