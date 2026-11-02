# Chapter 7: Tactical DDD

Lab for chapter 7 of *Software Architecture in Practice*.

Morada's bookings run thirteen commands (book and cancel) in two versions with the same output:

| Version | How it is modeled |
|---|---|
| `before` | Anemic model: bookings with public fields and every rule in one service. Any code can save an invalid booking |
| `after` | Rich model: value objects `Money` and `TimeSlot`, entity `Booking`, aggregate `Schedule` (no overlaps, minimum notice, monthly limit, cancellation fee), domain events, repository and application service |

## Prerequisite

Docker with Docker Compose. Choose the language in `.env` (`node`, `php`, `python` or `java`).

## Walkthrough

```bash
# Run the commands with each version and check against the approved result
docker compose run --rm app before
docker compose run --rm tools verify before
docker compose run --rm app after
docker compose run --rm tools verify after

# Tests: one shows the invalid state the anemic model accepts; the others, the invariants
docker compose run --rm app tests
```

The `output/<version>` folder holds the result of each command, the published events and the
final schedule (`results.txt`, `events.txt` and `schedule.txt`).

## Try it

- Try to create two overlapping bookings in the `after` version without going through the
  schedule.
- Add the rule "at most 8 hours in a row" and compare where it goes in each version.
- Implement "move the booking to another space" as a domain service.
