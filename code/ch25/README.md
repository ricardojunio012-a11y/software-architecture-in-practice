# Chapter 25: Asynchronous processing and queues in system design

Lab for chapter 25 of *Software Architecture in Practice*.

Monthly invoice generation for 3,000 communities, with a queue in a PostgreSQL table (`FOR UPDATE SKIP LOCKED` and a visibility timeout) and 16 workers. One worker dies holding a task, and another stalls and is blocked by the ownership token when it tries to complete a task that has already been redone; invoice reissue requests jump the line; a payment processor with a limit of 8 concurrent calls rejects the workers until they apply backpressure.

| Version | What it does |
|---|---|
| `queue` | Processes the 3,000 tasks with one worker that dies midway and another that stalls, and checks that no invoice was duplicated |
| `pressure` | Inserts 50 high-priority invoice reissues in the middle of the generation, without and with backpressure in front of the payment processor |

## Prerequisite

Docker with Docker Compose. This lab has only the TypeScript version. PostgreSQL starts on its own.

## Walkthrough

```bash
docker compose run --rm app queue
docker compose run --rm tools verify queue
docker compose run --rm app pressure
docker compose run --rm tools verify pressure
docker compose run --rm app tests
```

## Try it

- Remove the idempotency of the invoices and count the duplicates.
- Shorten the visibility timeout and watch tasks being redone for no reason.
- Remove the ownership token from `complete` and watch the slow worker complete a task that is no longer its own.
- Remove the priority of the reissues.
