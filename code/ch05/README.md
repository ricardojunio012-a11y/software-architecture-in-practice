# Chapter 5: design patterns

Lab for chapter 5 of *Software Architecture in Practice*.

Morada's Bookings module processes eight booking requests for the party room and the grill
area. Each part of the flow uses a pattern:

| Part | Pattern |
|---|---|
| Approval in four stages (unit in good standing, minimum notice, space available, monthly limit) | Chain of Responsibility and Template Method |
| Bookings stored and queried (only approved ones take the space) | Repository |
| Booking life cycle (pending, approved, rejected, canceled) | State |
| Reactions to the booking (usage fee, front desk, notice to the resident) | Publish/subscribe (a relative of Observer) |
| Notice channels (email, push notification, SMS) picked by the resident's preference | Strategy and Factory |
| Retries with growing waits, only for transient failures, and logging | Decorator |

The messaging providers are simulated: no data leaves your machine. One app device and one
phone fail on purpose on the first attempts (`simulatedFailures` in `input/bookings.json`)
and one email address does not exist (`invalidDestinations`). The waits between attempts
use a simulated clock: nothing really waits, and the output is always the same.

## Prerequisite

Docker with Docker Compose. Choose the language in `.env` (`node`, `php`, `python` or `java`).

## Walkthrough

```bash
# Process the requests and check them against the approved result
docker compose run --rm app bookings
docker compose run --rm tools verify bookings

# Tests: one per pattern
docker compose run --rm app tests
```

The `output/bookings` folder holds the decisions, the log of delivery attempts, the waits
between attempts, what the providers delivered, the usage fees charged, the front desk list,
the subscriber failures, the cancellations (State) and the result of the simultaneous
requests.

## Now the hard part

`concurrency.txt` shows two requests for the party room on the same day going through the
chain before either one saves (the interleaving is forced, so the output is deterministic).
Checking and then saving approves both: a double booking. Saving only if the space is free,
in a single operation (`saveIfFree`), approves one. In a database, the same idea becomes a
constraint in the database (chapter 28).

## Try it

- Swap the order of the decorators in the channel factory and compare `notifications.txt`.
- Create a `NotOnHoliday` stage and fit it into the approval chain.
- Create a `BoardPresidentSummary` subscriber without changing any existing class, only the
  assembly.
