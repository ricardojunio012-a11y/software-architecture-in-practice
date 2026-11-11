# Chapter 22: Horizontal scaling and load balancing

Lab for chapter 22 of *Software Architecture in Practice*.

Three replicas of the dashboard API behind NGINX, with the board president's session in each replica's memory or in Redis, a replica going down mid-use, and a simulation of load-balancing algorithms.

| Version | What it does |
|---|---|
| `memory-session` | Login and nine dashboard requests, with the session in the replicas' memory |
| `redis-session` | The same, with the session in Redis |
| `crash` | Thirty requests, with `api2` no longer accepting connections after the tenth |
| `algorithms` | Simulates round robin, least connections, two choices, and community hash with the same load |

## Prerequisite

Docker with Docker Compose. This lab has only the TypeScript version. Each scenario that goes through the load balancer waits 31 seconds before it starts, so NGINX uses all the replicas again.

## Walkthrough

```bash
docker compose run --rm app memory-session
docker compose run --rm tools verify memory-session
docker compose run --rm app redis-session
docker compose run --rm tools verify redis-session
docker compose run --rm app crash
docker compose run --rm tools verify crash
docker compose run --rm app algorithms
docker compose run --rm tools verify algorithms
docker compose run --rm --no-deps app tests
docker compose down
```

## Try it

- Turn on sticky sessions (`ip_hash`) in NGINX and watch the in-memory session "work".
- Turn off retries (`proxy_next_upstream off`) and watch the board president get the error from the crash.
- Send SIGTERM to a replica (`docker compose kill -s SIGTERM api1`) and watch the graceful shutdown; without the signal handler in `node/src/api.ts`, `docker compose stop` waits out the grace period and kills the process.
