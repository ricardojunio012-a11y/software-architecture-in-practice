# Chapter 40: infrastructure cost and FinOps

Lab for chapter 40 of *Software Architecture in Practice*.

Morada's cost calculator, in TypeScript. It reads a table of inputs, in which each value says where it came from (the book chapter, the AWS public price list, or a lab premise), and computes one month's cost of goods sold, separating infrastructure and people. There is no cloud and there are no services: it is only arithmetic, and the result is always the same.

| Version | What it does |
|---|---|
| `unit` | Shows the inputs, one month's cost today, the cost per community and per invoice, and the showback per module |
| `growth` | Projects 10 times more communities in three architectures (pool, cells, and silos), line by line |
| `cfo` | Builds the table for the finance leadership: revenue, COGS, gross margin, and cost per unit |
| `commitment` | Computes how much to commit in a Savings Plan for the nodes and how much the database reservation saves |

## Prerequisite

Docker with Docker Compose. This lab has only the TypeScript version and starts no other services.

## Walkthrough

```bash
docker compose run --rm app unit
docker compose run --rm tools verify unit
docker compose run --rm app growth
docker compose run --rm tools verify growth
docker compose run --rm app cfo
docker compose run --rm tools verify cfo
docker compose run --rm app commitment
docker compose run --rm tools verify commitment
docker compose run --rm app tests
```

## Try it

- Swap the assistant on the smaller model ($0.21 per community) for the larger one ($4.20, chapter 20) and look at the margin.
- Change the support capacity from 1,000 to 2,000 communities per person.
- Lower the installations per platform person from 5 to 3 and compare cells and silos.
- Change the month's usage profile and find the new optimal commitment.
- After each change, `verify` will fail: that is the signal that the result changed.
