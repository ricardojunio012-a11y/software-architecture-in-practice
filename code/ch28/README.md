# Chapter 28: Concurrency and idempotency

Lab for chapter 28 of *Software Architecture in Practice*.

Twenty residents ask for the grill area for the same Saturday afternoon, at the same instant, each over its own connection. The booking that checks before inserting accepts more than one; optimistic locking and the PostgreSQL exclusion constraint (`EXCLUDE USING gist`) accept only one. Then the resident taps the "pay" button twice: without an idempotency key, two payments go through; with the same key on both taps, one does.

| Version | What it does |
|---|---|
| `bookings` | Fires the 20 requests at the three ways of booking and counts the bookings stored |
| `payment` | Fires the two taps together, without and with an idempotency key |

## Prerequisite

Docker with Docker Compose. This lab has only the TypeScript version. PostgreSQL starts on its own.

## Walkthrough

```bash
docker compose run --rm app bookings
docker compose run --rm tools verify bookings
docker compose run --rm app payment
docker compose run --rm tools verify payment
docker compose run --rm app tests
```

## Try it

- Remove the `ROLLBACK` from optimistic locking when the version changed and count the bookings.
- Change `&&` to `=` in the exclusion constraint and book two time slots that overlap.
- Generate a new key on every tap, instead of one per intent to pay, and watch the protection disappear.
