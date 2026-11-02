# Chapter 8: Architectural styles

Lab for chapter 8 of *Software Architecture in Practice*.

Two styles side by side: a layered bookings API and a billing core with one plugin per bank (microkernel).

| Version | What it does |
|---|---|
| `layers` | Layered bookings API (presentation, application, domain, data). The requests in `input/requests.json` are sent through the framework's test client |
| `plugins` | Billing core that loads one plugin per bank from the language's plugins folder, without rebuilding the image |

## Prerequisite

Docker with Docker Compose. Choose the language in `.env` (`node`, `php`, `python` or `java`).

## Walkthrough

```bash
docker compose run --rm app layers
docker compose run --rm tools verify layers
docker compose run --rm app plugins
docker compose run --rm tools verify plugins
docker compose run --rm app tests
```

## Try it

- Create a Cedar Bank plugin by copying the Alpha Bank one and run `plugins` again, without `docker compose build`.
- Make the Beta Bank plugin throw an error and see that the other banks' lines stay correct.
- Add to the confirmed booking how many days are left until the date, and count how many layers changed.
