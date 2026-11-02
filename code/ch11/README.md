# Chapter 11: Event-driven architecture

Lab for chapter 11 of *Software Architecture in Practice*.

Billing publishes `PaymentConfirmed`, and Bookings and Communications react. Three ways to publish the event, with a scenario in which the process crashes after saving (`input/scenario.json`).

| Version | What it does |
|---|---|
| `in-memory` | In-memory bus, no failures |
| `dual-write` | Saves to the database and then publishes to RabbitMQ. The crash between the two steps loses an event |
| `outbox` | Saves the event in the same transaction, and a relay publishes it. The crash repeats an event, and the idempotent subscribers ignore it |

## Prerequisite

Docker with Docker Compose. Choose the language in `.env` (`node`, `php`, `python`, or `java`). Compose starts PostgreSQL and RabbitMQ along with the application.

## Walkthrough

```bash
docker compose run --rm app in-memory
docker compose run --rm tools verify in-memory
docker compose run --rm app dual-write
docker compose run --rm tools verify dual-write
docker compose run --rm app outbox
docker compose run --rm tools verify outbox
docker compose run --rm app tests
```

In the `outbox` version, `execution.txt` shows the relay crashing and publishing again, and `consumption.txt` shows the subscribers ignoring the duplicate.

## Try it

- Remove the check for already-handled events from the Communications subscriber and count the duplicate notices.
- Add a Front Desk module that subscribes to `PaymentConfirmed` and count how many Billing files changed.
