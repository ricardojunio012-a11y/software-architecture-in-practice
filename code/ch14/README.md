# Chapter 14: Test architecture

Lab for chapter 14 of *Software Architecture in Practice*.

A consumer-driven contract between the monolith and the Communications service, integration tests against a real PostgreSQL in a container, and a measurement of the time each layer of the suite takes.

| Version | What it does |
|---|---|
| `consumer` | The monolith's client talks to a test double and publishes `output/consumer/contract.json` |
| `provider` | Reads the contract, sets up the state of each interaction and verifies the real Communications API |

## Prerequisite

Docker with Docker Compose. Choose the language in `.env` (`node`, `php`, `python` or `java`). Compose starts a PostgreSQL for the integration and end-to-end tests.

## Walkthrough

```bash
docker compose run --rm app consumer
docker compose run --rm tools verify consumer
docker compose run --rm app provider
docker compose run --rm tools verify provider

# Unit, integration and end-to-end tests
docker compose run --rm app tests

# Time of each layer, as reported by the test tool
docker compose run --rm app measure
```

## Try it

- Change `duplicate` to `repeated` in the Communications API and run the provider again.
- Add a `sentAt` field to the response and see that the contract is still verified.
- Remove `PRIMARY KEY` from the notices table and find out which test fails.
