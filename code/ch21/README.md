# Chapter 21: performance, latency, and load testing

Lab for chapter 21 of *Software Architecture in Practice*.

The delinquency route of the board president's dashboard under the load of the 5th (the due date), simulated with k6. The `n1` version runs one query per unit; the `fixed` version, a single query. Both return the same response.

| Version | What it does |
|---|---|
| `n1` | Starts the API with the N+1 route, profiles one request, and runs the load test |
| `fixed` | The same with the fixed route |

The profile of each version (queries per request and a digest of the response) goes to `output/<version>/profile.txt` and is verified. The timings depend on the machine and go to `output/times-<version>.txt`, outside the verification.

## Prerequisites

Docker with Docker Compose. This lab has only the TypeScript version. PostgreSQL starts on its own; k6 comes inside the application image.

## Walkthrough

```bash
docker compose run --rm app n1
docker compose run --rm tools verify n1
docker compose run --rm app fixed
docker compose run --rm tools verify fixed
docker compose run --rm app tests
```

## Try it

- Shrink the connection pool and watch the tail grow.
- Replace the k6 scenario with a fixed number of users and watch coordinated omission hide the problem.
- Raise the load until the fixed version fails.
