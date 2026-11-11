// Fitness function of ADR-010: no module reads or writes another module's table.
// Atomic and static: reads the source code, including the SQL written in strings,
// which the dependency test of chapter 10 does not see.
import fs from "node:fs";
import path from "node:path";

// Each table has an owner, and the database schema has the owner module's name
export const OWNERS: Record<string, string[]> = {
  directory: ["units", "residents"],
  billing: ["charges", "installment_plans"],
  bookings: ["bookings", "spaces"],
};

const SQL = /\b(from|join|into|update)\s+([a-z_]+)(\.[a-z_]+)?/gi;

function files(folder: string): string[] {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((e) => {
    const entry = path.join(folder, e.name);
    return e.isDirectory() ? files(entry) : entry.endsWith(".ts") ? [entry] : [];
  });
}

export function ownData(folder: string): string[] {
  const violations: string[] = [];
  for (const file of files(folder).sort()) {
    const relative = path.relative(folder, file).split(path.sep).join("/");
    const module = relative.split("/")[0];
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const [, verb, schema, table] of line.matchAll(SQL)) {
        const where = `${relative}:${i + 1}`;
        const action = /from|join/i.test(verb) ? "reads" : "writes";
        if (!table) violations.push(`${where} ${action} ${schema} without a schema`);
        else if (!OWNERS[schema]?.includes(table.slice(1)))
          violations.push(
            `${where} ${action} ${schema}${table}, a table with no owner`,
          );
        else if (schema !== module)
          violations.push(`${where} ${action} ${schema}${table}, owned by ${schema}`);
      }
    });
  }
  return violations;
}
