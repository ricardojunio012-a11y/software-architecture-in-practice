# Chapter 26: Real time and the edge

Lab for chapter 26 of *Software Architecture in Practice*.

Visitor notices over WebSocket between two API replicas, without and with pub/sub in Redis; and the front-desk device that loses its network, keeps the gate entries in a local queue and sends them over MQTT when the network comes back. In the hard part, the device restarts with no network and entries in the queue: the in-memory queue loses everything, the queue in a SQLite file loses nothing.

| Version | What it does |
|---|---|
| `realtime` | The front-desk staff register two visitors through api1; the residents are connected to different replicas |
| `offline` | Ten entries, with the front-desk network and the server down for a while, and one duplicate |
| `restart` | The device records three entries with no network and is killed with SIGKILL; in-memory queue versus SQLite queue |

## Prerequisite

Docker with Docker Compose. This lab has only the TypeScript version. Compose starts the two replicas, Redis and the MQTT broker (Mosquitto). The MQTT clients use protocol 5.0 (`protocolVersion: 5`).

## Walkthrough

```bash
docker compose run --rm app realtime
docker compose run --rm tools verify realtime
docker compose run --rm app offline
docker compose run --rm tools verify offline
docker compose run --rm app restart
docker compose run --rm tools verify restart
docker compose run --rm --no-deps app tests
docker compose down
```

## Try it

- Disconnect a resident before the notice and think about how they find out what they missed.
- Publish the entries directly, without the local queue.
- Set the server's `sessionExpiryInterval` to zero, keeping `clean: false`, and watch the entries get lost.
