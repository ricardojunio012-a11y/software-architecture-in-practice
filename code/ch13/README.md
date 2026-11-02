# Chapter 13: Front end, mobile, and Backend for Frontend

Lab for chapter 13 of *Software Architecture in Practice*.

The BFF of the front-desk tablet: the home screen in a single call and the sync of the operations made without internet, with a local queue, an id per operation, and the version of the data.

| Version | What it does |
|---|---|
| `online` | Both tablets connected all the time |
| `offline` | Tablet A loses the internet, stores three operations, and resends them when it comes back; the first response is lost |
| `restart` | The hard part: the BFF restarts between the lost send and the resend, and in-memory idempotency fails (a false conflict and a visitor registered twice) |
| `persisted` | The same script, with the result of each operation kept outside the BFF's memory: the resend is recognized again |

## Prerequisite

Docker with Docker Compose. Choose the language in `.env` (`node`, `php`, `python` or `java`).

## Walkthrough

```bash
docker compose run --rm app online
docker compose run --rm tools verify online
docker compose run --rm app offline
docker compose run --rm tools verify offline
docker compose run --rm app restart
docker compose run --rm tools verify restart
docker compose run --rm app persisted
docker compose run --rm tools verify persisted
docker compose run --rm app tests
```

Compare the two `log.txt` files: the conflict moves from one tablet to the other depending on the order in which the operations arrive. Then compare `restart/state.txt` with `persisted/state.txt`: idempotency holds only while the record of the applied operations exists.

## Try it

- Make the BFF ignore the operation id and watch the resend.
- Make Front Desk ignore the version (last writer wins) and see who finds out.
- Add a field to the home screen without breaking a tablet that does not know it yet.
