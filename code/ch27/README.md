# Chapter 27: Distributed systems fundamentals

Lab for chapter 27 of *Software Architecture in Practice*.

A PostgreSQL leader and a replica, with Toxiproxy in the replication path. The lab cuts the network and shows the two choices of the CAP theorem: with asynchronous replication, the write is accepted and the replica keeps the old value; with synchronous replication, the write waits for the network to come back. In the hard part, a second replica (the candidate) is promoted to leader during the partition: both sides confirm writes, and the old leader's write is lost when the network comes back.

| Version | What it does |
|---|---|
| `async` | Cuts the network, changes the quiet hours on the leader, and reads from the leader and from the replica |
| `sync` | The same, with synchronous replication: the write stays unconfirmed until the network comes back |
| `promotion` | Cuts the network to the candidate, confirms a write on the leader, promotes the candidate, confirms another write on it, and shows the lost write; at the end, rebuilds the candidate from the leader |

## Prerequisite

Docker with Docker Compose. This lab has only the TypeScript version.

## Walkthrough

```bash
docker compose run --rm app async
docker compose run --rm tools verify async
docker compose run --rm app sync
docker compose run --rm tools verify sync
docker compose run --rm app promotion
docker compose run --rm tools verify promotion
docker compose run --rm --no-deps app tests
docker compose down
```

## Try it

- Replace the network cut with latency (a `latency` toxic) and measure the writes.
- Always read from the leader in the asynchronous scenario.
