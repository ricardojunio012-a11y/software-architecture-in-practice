# Chapter 15: API design

Lab for chapter 15 of *Software Architecture in Practice*.

Morada's public API for management companies: the management company is identified on every request (the `Morada-Management-Company` header stands in for the OAuth token), each one sees only its own communities (`input/communities.json`), the charge listing has a filter and cursor pagination, errors follow RFC 9457, and payments are recorded with an idempotency key, unique per management company, stored in the same transaction as the payment. The contract is in `openapi/v1.yaml`; the copy in `openapi/published/v1.yaml` is what clients already use.

| Version | What it does |
|---|---|
| `api` | Sets up the database, sends the 14 requests in `input/requests.json` and checks each response against the contract |
| `compatibility` | Compares the proposals in `input/proposals` with the published contract and says which ones break clients |

## Prerequisite

Docker with Docker Compose. Choose the language in `.env` (`node`, `php`, `python` or `java`). Compose starts a PostgreSQL alongside the application.

## Walkthrough

```bash
docker compose run --rm app api
docker compose run --rm tools verify api
docker compose run --rm app compatibility
docker compose run --rm tools verify compatibility

# Includes the test that breaks when openapi/v1.yaml changes incompatibly
# and five simultaneous payments with the same key
docker compose run --rm app tests
```

The `output/api` folder has the responses (`responses.txt`), the final state of the database (`state.txt`) and the check against the contract (`contract.txt`).

## Try it

- Make the API return `amountCents` as text and read `contract.txt`.
- Rename a field in `openapi/v1.yaml` and run the tests.
- Store the idempotency key's response in a separate transaction and think about the failure that allows.
- Change the primary key of `idempotency_keys` back to just `key` and see what management company MC-B gets on request 13.
