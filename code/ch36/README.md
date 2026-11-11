# Chapter 36: Security architecture

Lab for chapter 36 of *Software Architecture in Practice*.

A real Keycloak 26.4 issues OpenID Connect tokens for Morada's roles (board president, resident, front desk, and management company). The invoices API checks the token and the role but, in the first version, does not check whether the requested invoice belongs to the caller: an authenticated resident reads the invoices of other communities just by changing the number in the URL (IDOR, or BOLA, the first item of the OWASP API Security Top 10 2023). The fixed version checks each user's relation to each invoice, in a small Zanzibar-style relation model. The third version takes the secrets out of the code: a "vault" generates the secrets in a Docker volume, Keycloak and the application read them from there, and the integration's secret is rotated through the Keycloak admin API.

| Version | What it does |
|---|---|
| `idor` | Logs in the five people, tries forged tokens, the role (RBAC), and invoice enumeration against the vulnerable API |
| `fixed` | The same script against the API with authorization by object |
| `secrets` | Scans the code for secrets, uses the vault's secret in the integration, and rotates the secret |

## Prerequisite

Docker with Docker Compose. No port is published on the host: everything talks over the Compose internal network. The first Keycloak start takes one to four minutes, depending on the machine.

## Walkthrough

```bash
docker compose run --rm app idor
docker compose run --rm tools verify idor
docker compose run --rm app fixed
docker compose run --rm tools verify fixed
docker compose run --rm app secrets
docker compose run --rm tools verify secrets
docker compose run --rm app tests
docker compose down -v
```

`down -v` also deletes the volume with the secrets; the next start generates new secrets.

## Try it

- In `src/api.ts`, change the 404 response for someone else's invoice to 403. What does an attacker learn from the difference?
- In `src/data.ts`, add the tuple that makes the front-desk staff member `carol` a reader of C-01's invoices and run `fixed`. Why does she still read nothing?
- In `src/identity.ts`, remove the audience check and write a test in which a token issued for another API is accepted.
- Run `secrets` twice in a row and explain why the result is the same, even though the secret changes each time.
- Run `docker compose exec keycloak sh -c "cat /proc/1/environ | tr '\0' '\n' | grep SECRET"` and see where the secrets show up in the Keycloak container. What does that say about secrets in environment variables?
