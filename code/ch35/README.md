# Chapter 35: High availability and disaster recovery

Lab for chapter 35 of *Software Architecture in Practice*.

Morada's production database runs with continuous WAL archiving on. The lab takes a base backup, drops the charges table by mistake, and recovers it up to the moment before the accident on a separate instance, without losing what was written afterward; measures the RPO when the whole server is lost; and takes down replicas and a zone of the notices API during traffic, checking the steady-state hypothesis.

| Version | What it does |
|---|---|
| `pitr` | Base backup, 400 payments, a mistaken `DROP TABLE`, point-in-time restore on a separate instance, and copy of the table back to production |
| `disaster` | The server is lost with 40 payments in a WAL segment not yet archived: the restore recovers everything except those 40 |
| `chaos` | 1,000 requests per experiment against API replicas in two zones, taking down one replica or a whole zone in the middle of the traffic |

## Prerequisite

Docker with Docker Compose. This lab has only the TypeScript version. PostgreSQL and the three API replicas start on their own, without publishing any port on the host.

## Walkthrough

```bash
docker compose run --rm app pitr
docker compose run --rm tools verify pitr
docker compose run --rm app disaster
docker compose run --rm tools verify disaster
docker compose run --rm app chaos
docker compose run --rm tools verify chaos
docker compose run --rm app tests
docker compose down -v
```

The time of each restore stage (the measured RTO) goes to `output/timings/`, outside the verification, because it changes from machine to machine.

## Try it

- In `pitr.ts`, comment out the call to `closeSegment` and run it again. The restore fails: the WAL with the latest payments has not reached the archive yet. Read the message in the printed log.
- In `pitr.ts`, replace the table copy with promoting the restored instance as the new production. How many notices are lost?
- In `db/entrypoint.sh`, set `archive_timeout=1`, recreate the database (`docker compose down -v`), and run `disaster` waiting two seconds before the loss. What changes in the RPO? How much does the `archive` volume grow?
- Raise the charges to 3 million in `data.ts` and measure the RTO again.
- In `chaos.ts`, make the balancer try another replica only in the same zone. Which experiment changes?
