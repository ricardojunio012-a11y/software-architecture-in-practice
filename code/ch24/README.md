# Chapter 24: Scaling the database

Lab for chapter 24 of *Software Architecture in Practice*.

A real read replica, delayed on purpose by two seconds; the front desk entries table partitioned by month; and the charges of nine communities split across three databases, with routing in the application, logical shards, and identifiers with the shard embedded.

| Version | What it does |
|---|---|
| `replica` | The resident pays on the primary and reads from the delayed replica; then reads their own write using the log position |
| `partition` | Shows which partitions each query reads and removes a whole month with a `DROP` of the partition |
| `sharding` | Distributes the charges, queries one community and all of them, decodes an ID, and moves a logical shard |

## Prerequisite

Docker with Docker Compose. This lab has only the TypeScript version. Compose starts the primary and the replica; the three shards are databases on the same server.

## Walkthrough

```bash
docker compose run --rm app replica
docker compose run --rm tools verify replica
docker compose run --rm app partition
docker compose run --rm tools verify partition
docker compose run --rm app sharding
docker compose run --rm tools verify sharding
docker compose run --rm --no-deps app tests
docker compose down
```

## Try it

- Remove the replica delay and see whether the read right after the write still fails.
- Insert an entry in a month with no partition.
- Simulate a community that holds half of all the charges.
