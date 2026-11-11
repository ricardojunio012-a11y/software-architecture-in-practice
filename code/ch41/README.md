# Chapter 41: legacy modernization and evolutionary architecture

Lab for chapter 41 of *Software Architecture in Practice*.

Morada bought Beta, a competitor with a system from 2009. The lab puts a proxy in front of the legacy API, translates the old model in an anticorruption layer, migrates one customer's data (Acacia Grove) with reconciliation, runs the legacy and Morada in parallel comparing the answers and, finally, turns off the first part of the legacy.

Everything runs in a single container: the legacy (SQLite, through `node:sqlite`), Morada (embedded PostgreSQL, PGlite), the compatibility layer and the proxy, each on its own HTTP server, on internal ports. No port is published on the host. Time is simulated (one day at a time, from November 1, 2026) and the app's usage is drawn with a fixed seed. That is why the result is the same on every run.

The legacy keeps the habits of its original vendor: amounts are text with a thousands comma (`"1,048.72"`) and dates put the day first (`"10/11/2026"` is November 10).

| Version | What it does |
|---|---|
| `inventory` | The proxy only observes: 30 days of use, counted by route |
| `translation` | The anticorruption layer translates Acacia Grove, with before-and-after examples |
| `migration` | Naive copy, migration through the layer, and the same migration repeated, with reconciliation |
| `parallel` | Two rounds of parallel run, before and after the fixes |
| `decommission` | Acacia Grove moves to Morada, the unused route is turned off, and the legacy loses Acacia Grove |

## Prerequisite

Docker with Docker Compose. This lab has only the TypeScript version. The first start of PGlite can take 10 to 30 seconds.

## Walkthrough

```bash
docker compose run --rm app inventory
docker compose run --rm tools verify inventory
docker compose run --rm app translation
docker compose run --rm tools verify translation
docker compose run --rm app migration
docker compose run --rm tools verify migration
docker compose run --rm app parallel
docker compose run --rm tools verify parallel
docker compose run --rm app decommission
docker compose run --rm tools verify decommission
docker compose run --rm app tests
```

## Try it

- In `legacy/database.ts`, change the board president's note to "Board pres. - dues exempt" and run `parallel`. Does the v2 rule of the layer still find the exemption? And if the note says "former board pres."?
- In `versions/parallel.ts`, remove the link of G-10 from the v2 rules. What does round 2 show, and what does `decommission` say in the checklist?
- In `proxy.ts`, accept differences of up to 50 cents as rounding. Which real divergence would slip through hidden?
- In `versions/decommission.ts`, move the reconciliation to after the 30 days of use. Why does it fail, if nothing went wrong?
