# Chapter 23: Caching and CDNs

Lab for chapter 23 of *Software Architecture in Practice*.

The board president's financial dashboard with cache-aside in Redis, invalidation after a payment, the cache stampede with three ways to fetch, and probabilistic early expiration (XFetch).

| Version | What it does |
|---|---|
| `cache-aside` | First request from the database, the next ones from the cache, and invalidation after a payment |
| `stampede` | 200 concurrent requests with the key not in the cache: no protection, a shared promise, and a lock in Redis; then a lock whose TTL is shorter than the load, released without checking the owner and with compare-and-delete (Lua) |
| `xfetch` | Simulates five minutes of requests for an expensive report, with fixed expiration and with early expiration |

## Prerequisite

Docker with Docker Compose. This lab has only the TypeScript version. PostgreSQL and Redis start on their own.

## Walkthrough

```bash
docker compose run --rm app cache-aside
docker compose run --rm tools verify cache-aside
docker compose run --rm app stampede
docker compose run --rm tools verify stampede
docker compose run --rm app xfetch
docker compose run --rm tools verify xfetch
docker compose run --rm app tests
docker compose down
```

## Try it

- Spread the stampede requests across three cache objects, like three replicas, and compare the promise with the lock.
- Swap the order of the invalidation and the `UPDATE`.
- Replace `releaseLock` with a plain `del` and force a load longer than the lock's TTL.
- Raise the generation cost in the XFetch simulation.
