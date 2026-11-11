// The board president's dashboard API, with the delinquency route in the chosen
// version. It counts the queries and the time spent in the database, the minimum
// instrumentation needed to know where the time of each request goes.
import http from "node:http";
import pg from "pg";
import { type Querier, delinquencyFixed, delinquencyN1 } from "./delinquency.ts";

const version = process.env.VERSION;
const route = version === "n1" ? delinquencyN1 : delinquencyFixed;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

export const profile = { queries: 0, dbMs: 0 };
const measured: Querier = {
  async query(sql, params) {
    const start = performance.now();
    try {
      return await pool.query(sql, params);
    } finally {
      profile.queries++;
      profile.dbMs += performance.now() - start;
    }
  },
};

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (url.pathname === "/health") return response.end("ok");
  if (url.pathname === "/profile") {
    response.end(JSON.stringify(profile));
    profile.queries = 0;
    profile.dbMs = 0;
    return;
  }
  const m = url.pathname.match(/^\/communities\/(\d+)\/delinquent$/);
  if (!m) {
    response.statusCode = 404;
    return response.end();
  }
  const rows = await route(measured, Number(m[1]));
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(rows));
});
server.listen(3000);
