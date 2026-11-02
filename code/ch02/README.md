# Chapter 2: quality requirements and communicating the architecture

Lab for chapter 2 of *Software Architecture in Practice*.

Morada's quality requirements become written scenarios (`docs/quality-scenarios.md`), and two of
them become **executable** scenarios: a program generates the load of the 1st, measures the
calculation of the charges, estimates the invoice creation at the payment processor and says
whether the target was met. The architecture is described with the C4 model, as code
(`docs/c4/workspace.dsl`), and with a short arc42 (`docs/architecture.md`). The `batch` command
simulates the batch invoice queue at the payment processor, with a throughput limit, partial
rejections and new attempts, and measures the time until each invoice is available (p50, p95,
p99) against the 4-hour target of PERF-02.

## Prerequisite

Docker with Docker Compose. No language needs to be installed.

## Choosing the language and the environment

Edit `.env`: `LANGUAGE` (`node`, `php`, `python` or `java`), and `CPUS` and `MEMORY` of the
container that runs the scenarios.

## Walkthrough

```bash
# 1. Run the performance scenarios (PERF-02 fails on purpose)
docker compose run --rm app scenarios

# 2. Now the hard part: simulate the batch invoice queue (fixed seed)
docker compose run --rm app batch
docker compose run --rm app batch | diff - expected/batch.txt

# 3. Run the tests of the scenario runner
docker compose run --rm app tests

# 4. See the C4 diagrams at http://localhost:8080
docker compose up -d structurizr

# 5. Shut down
docker compose down
```

## Try it

- Change `CPUS` to `0.25` in `.env` and run the scenarios again. The calculation gets slower, but
  the result does not change: the bottleneck is the payment processor.
- In `scenarios/scenarios.json`, change PERF-02's `invoicesPerSecond` to `2000` (batch creation
  by file) and run it again.
- In `scenarios/batch.json`, change `returnSeconds` to `10800` (return file after 3 hours) and run
  `batch` again. The division still says 10 minutes; compare the two strategies. The assumptions
  in the file are the lab's, not those of a real processor.
- Add a "Batch queue" container to `docs/c4/workspace.dsl` between billing and the payment
  processor and watch the diagram change.

When it opens the model, Structurizr creates `docs/c4/workspace.json` and `docs/c4/.structurizr/`;
both can be deleted.
