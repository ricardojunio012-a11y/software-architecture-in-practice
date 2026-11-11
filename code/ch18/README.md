# Chapter 18: Integration architecture

Lab for chapter 18 of *Software Architecture in Practice*.

A payment gateway webhook, signed in the Standard Webhooks format and received by two receivers, and the ACH return file of a fictional bank translated by an anticorruption layer.

| Version | What it does |
|---|---|
| `webhook` | Runs the same seven deliveries (`input/webhook.json`) through the naive receiver and the robust one, which checks the signature, the time window, duplicates, and order |
| `nacha` | Reads `input/alpha-bank-return.txt`, a simplified fixed-width layout inspired by Nacha ACH files, and returns the domain's payments |

## Prerequisite

Docker with Docker Compose. This lab has only the TypeScript version and uses no database.

## Walkthrough

```bash
docker compose run --rm app webhook
docker compose run --rm tools verify webhook
docker compose run --rm app nacha
docker compose run --rm tools verify nacha
docker compose run --rm app tests
```

## Try it

- Change the body of a delivery after it is signed and see which receiver notices.
- Turn off the order check and see which state C-103 ends up in.
- Mark the delivery as processed before applying it and watch the test "does not lose the delivery when apply fails" break.
- Cut the return file short and watch the trailer reject the whole file.
