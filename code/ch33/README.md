# Chapter 33: Continuous delivery, infrastructure as code, and the platform

Lab for chapter 33 of *Software Architecture in Practice*.

Three parts. In the first, a delivery pipeline runs the compiler, the tests, an architecture test, and a canary on four Morada commits, and blocks the deployment at the first stage that fails. In the second, the `mobile` column becomes `phone` with the application live: all at once (and breaking) and in three deployments (expand, migrate, contract), with the old and the new version serving together against the same PostgreSQL. In the third, OpenTofu creates the queue, the bucket, and the database of an environment, detects a change made outside it, and undoes it.

| Version | What it does |
|---|---|
| `pipeline` | Runs commits `c1` to `c4` (in `node/src/commits/`) through the pipeline; `c0` is the version in production |
| `rename` | Renames the column in the same deployment as the new code, in both possible orders |
| `expand` | Makes the switch in three deployments, with two versions live in each one |
| `shortcut` | The same deployments, but copying the data before the old version is gone |
| `infra` | Plans, applies, checks through the SDKs, causes drift, fixes it, and destroys |

## Prerequisite

Docker with Docker Compose. This lab has only the TypeScript version. It starts PostgreSQL 17 and LocalStack 4.14.0, without publishing any port on the host.

LocalStack started requiring an account and a token on March 23, 2026. Version 4.14.0, from February 2026, is the last one that runs without an account, so it is pinned. The free edition has no RDS: OpenTofu creates the reporting role and database in the Compose PostgreSQL, through the `cyrilgdn/postgresql` provider.

## Walkthrough

```bash
docker compose run --rm app pipeline
docker compose run --rm tools verify pipeline
docker compose run --rm app rename
docker compose run --rm tools verify rename
docker compose run --rm app expand
docker compose run --rm tools verify expand
docker compose run --rm app shortcut
docker compose run --rm tools verify shortcut
docker compose run --rm app infra
docker compose run --rm tools verify infra
docker compose run --rm app tests
docker compose down -v
```

The first image build downloads the OpenTofu providers (a few hundred megabytes). The `infra` version takes a few minutes, almost all of them spent loading the AWS provider on each command.

## Try it

- In `c3/domain/fees.ts`, remove the adapter `import` and pass the `isHoliday` function as a parameter: does the architecture test pass?
- In `c4/adapters/fixed-holidays.ts`, add the 2027 holidays and run the pipeline: the canary approves, and the change failure rate drops.
- In `canary.ts`, change the tolerance from 0.5 to 5 percentage points. What now reaches 100% of the traffic?
- In `deployments.ts`, in the `expand` scenario, drop the old column before v3 is gone. How many errors show up?
- In `infra/main.tf`, change `maxReceiveCount` to 3 and look at the plan before applying it.
