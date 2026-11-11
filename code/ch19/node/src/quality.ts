// Data quality tests: each check is a query that counts the rows that break a rule.
// Zero passes; any other number is a failure, reported with the count.
import type { DuckDBConnection } from "@duckdb/node-api";
import { looksPersonal } from "./pseudonym.ts";

export interface Check {
  name: string;
  sql: string;
}

export const CHECKS: Check[] = [
  {
    name: "unique charge in the fact",
    sql: "SELECT count(*) - count(DISTINCT charge_id) FROM fact_charge",
  },
  {
    name: "every community in the fact exists in the dimension",
    sql:
      "SELECT count(*) FROM fact_charge f " +
      "ANTI JOIN dim_community d USING (community_id)",
  },
  {
    name: "every community has a region",
    sql: "SELECT count(*) FROM dim_community WHERE region IS NULL",
  },
  {
    name: "positive amount in the source charges",
    sql: "SELECT count(*) FROM raw_charges WHERE amount_cents <= 0",
  },
  {
    name: "source = fact + quarantine",
    sql:
      "SELECT (SELECT count(*) FROM raw_charges) - " +
      "(SELECT count(*) FROM fact_charge) - " +
      "(SELECT count(*) FROM quarantine_charges)",
  },
];

export async function runChecks(con: DuckDBConnection): Promise<string[]> {
  const lines: string[] = [];
  for (const c of CHECKS) {
    const reader = await con.runAndReadAll(`SELECT (${c.sql})::INTEGER AS n`);
    const n = reader.getRowObjects()[0].n as number;
    lines.push(n === 0 ? `ok      ${c.name}` : `FAILED  ${c.name}: ${n} rows`);
  }
  lines.push(await noPersonalData(con));
  return lines;
}

// Scans every text column of every table for tax IDs and plates in the clear
export async function noPersonalData(con: DuckDBConnection): Promise<string> {
  const columns = await con.runAndReadAll(
    "SELECT table_name, column_name FROM information_schema.columns " +
      "WHERE data_type = 'VARCHAR' ORDER BY ALL",
  );
  let found = 0;
  for (const { table_name, column_name } of columns.getRowObjects()) {
    const values = await con.runAndReadAll(
      `SELECT DISTINCT "${column_name}" AS v FROM "${table_name}"`,
    );
    found += values.getRowObjects().filter((r) => looksPersonal(r.v)).length;
  }
  const name = "no tax ID or plate in the clear in the analytics database";
  return found === 0 ? `ok      ${name}` : `FAILED  ${name}: ${found} values`;
}
