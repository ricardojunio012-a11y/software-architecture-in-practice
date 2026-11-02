# Chapter 12: Microservices

Lab for chapter 12 of *Software Architecture in Practice*.

The Communications module extracted from the monolith as an HTTP service, with injected failures, retries, and idempotency.

| Version | What it does |
|---|---|
| `monolith` | Communications as a module, called inside the process |
| `service` | Communications as a separate service, called over HTTP with a timeout and retries with growing backoff and jitter |
| `contacts` | The hard part: Communications needs the residents' emails, which belong to the Directory. Compares querying the Directory through its API with keeping a replica fed by events, with the Directory down for 10 minutes (simulated clock) |

## Prerequisite

Docker with Docker Compose. Choose the language in `.env` (`node`, `php`, `python`, or `java`). Compose starts the Communications service along with the monolith.

## Walkthrough

```bash
docker compose run --rm app monolith
docker compose run --rm tools verify monolith
docker compose run --rm app service
docker compose run --rm tools verify service

# Mean time, p95, and worst notice of both versions, measured on your machine
docker compose run --rm tools compare

# The hard part: the residents' contacts belong to another module
docker compose run --rm app contacts
docker compose run --rm tools verify contacts
docker compose run --rm app tests
```

## Try it

- Change the client's maximum number of attempts to 1 and count the lost notices.
- Make the service ignore the notice id and count the duplicate notices.
- In `input/contacts.json`, raise `replicaLag` to 30 minutes and count the notices that go to an old email.
