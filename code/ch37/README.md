# Chapter 37: Privacy and compliance

Lab for chapter 37 of *Software Architecture in Practice*.

Charles Mitchell, the resident of unit 302 at Garden Court Condominiums, moves out and asks Morada for a copy of his data and for its deletion. The lab carries out the request in the production database, in the events already published to other modules, and in the previous night's backup, and shows an audit trail that exposes anyone who tries to rewrite it.

| Version | What it does |
|---|---|
| `naive` | Deletes the directory row. The published events and the backup still hold the name, the SSN, and the email, and restoring the backup brings the former resident back |
| `erasure` | Each consumer has their own key, and personal data is written encrypted. The deletion removes the directory row and destroys the key; events and backup become unreadable for him and stay readable for everyone else |
| `audit-trail` | Eight hash-chained entries. The application and the database owner cannot change them; someone who turns off the triggers can, and the verification flags it. Rewriting the hashes and cutting the end are caught only with the anchor published outside the database |

## Prerequisite

Docker with Docker Compose. This lab has only the TypeScript version. PostgreSQL starts on its own, without publishing any port on the host. The test master key is in `.env`.

## Walkthrough

```bash
docker compose run --rm app naive
docker compose run --rm tools verify naive
docker compose run --rm app erasure
docker compose run --rm tools verify erasure
docker compose run --rm app audit-trail
docker compose run --rm tools verify audit-trail
docker compose run --rm app tests
docker compose down -v
```

The copy delivered to the consumer is in `output/<version>/export.json`, and the backups are in `output/backups/`.

## Try it

- Search for the former resident's SSN in both backups: `grep -c 916-18-0339 output/backups/*.sql`.
- In `lab.ts`, make the backup include the `vault` schema and look for consumer 3's key in the file. Anyone with the backup and the master key recovers the former resident.
- Write the SSN in plain text in the `target` field of a trail entry and run `erasure`: the search flags the personal data inside the trail itself.
- Move the anchor to entry 6 and run `audit-trail` again. Which attacks now go unnoticed?
