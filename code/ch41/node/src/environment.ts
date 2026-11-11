// Sets up the lab: the legacy, Morada, the compatibility layer and the proxy, each
// on its own HTTP server. And simulates the use of Beta's app, day by day.
import type { PGlite } from "@electric-sql/pglite";
import type { DatabaseSync } from "node:sqlite";
import { compatBeta } from "./acl/compat.ts";
import { clock, generator, nextDay } from "./common.ts";
import { call, serve, type Server } from "./http.ts";
import {
  ACACIA,
  computeAssessments,
  createLegacy,
  IRONWOOD,
} from "./legacy/database.ts";
import { legacyApi } from "./legacy/server.ts";
import { createMorada } from "./morada/database.ts";
import { moradaApi } from "./morada/server.ts";
import { BetaProxy } from "./proxy.ts";

export type Environment = {
  legacy: DatabaseSync;
  morada: PGlite;
  proxy: BetaProxy;
  url: string; // the address Beta's app uses: the proxy's
  close: () => Promise<void>;
};

export async function setUp(): Promise<Environment> {
  clock.today = "2026-11-01";
  const legacy = createLegacy();
  // The month's closing: the legacy computes November's assessments on the 1st
  computeAssessments(legacy, ACACIA, "11/2026");
  computeAssessments(legacy, IRONWOOD, "11/2026");
  const morada = await createMorada();
  const servers: Server[] = [];
  const s1 = await serve(legacyApi(legacy));
  const s2 = await serve(moradaApi(morada));
  const proxy = new BetaProxy(s1.url, compatBeta(s2.url, morada));
  const s3 = await serve(proxy.handle);
  servers.push(s1, s2, s3);
  return {
    legacy,
    morada,
    proxy,
    url: s3.url,
    close: async () => {
      for (const s of servers) await s.close();
      await morada.close();
    },
  };
}

// Today in the legacy's format, day first: "05/11/2026" is November 5
const legacyToday = () => clock.today.split("-").reverse().join("/");

// Beta's app in use: reads of apts, assessments and delinquents, payments and
// notices. The draw has a fixed seed.
export async function useApp(
  url: string,
  properties: string[],
  days: number,
  seed: number,
): Promise<void> {
  const draw = generator(seed);
  for (let d = 0; d < days; d++) {
    for (const p of properties) {
      if (draw() < 0.3) await call(url, "GET", `/properties/${p}/apts`);
      if (draw() < 0.6)
        await call(url, "GET", `/properties/${p}/assessments?period=11/2026`);
      if (draw() < 0.4)
        await call(url, "GET", `/properties/${p}/assessments?period=10/2026`);
      if (draw() < 0.5) {
        const r = await call(url, "GET", `/properties/${p}/delinquents`);
        const list = r.body as { apt: string; periods: string[] }[];
        if (list.length > 0 && draw() < 0.6) {
          const chosen = list[Math.floor(draw() * list.length)];
          await call(url, "POST", `/properties/${p}/assessments/${chosen.apt}/pay`, {
            period: chosen.periods[0],
            pay_date: legacyToday(),
          });
        }
      }
      if (draw() < 0.15)
        await call(url, "POST", `/properties/${p}/notices`, { title: "Notice" });
    }
    nextDay();
  }
}
