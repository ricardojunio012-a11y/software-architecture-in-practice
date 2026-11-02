# Chapter 3: coupling, cohesion, and modularity

Lab for chapter 3 of *Software Architecture in Practice*.

Morada's billing module produces three reports: charges, delinquency, and the financial report to owners. The
lab has two versions of the same code, with the same output:

| Version | How it is organized |
|---|---|
| `before` | By technical type (`config`, `util`, `services`, `reports`), with global configuration, a parameter that decides what the function does, a module that changes another module's list, and a dependency cycle |
| `after` | By responsibility (`charges`, `delinquency`, `financialreport`, `shared`), with a public interface in each module, immutable data, and no cycles |

## Prerequisite

Docker with Docker Compose. Choose the language in `.env` (`node`, `php`, `python`, or `java`).

## Walkthrough

```bash
# Generate the reports with each version and check them against the approved result
docker compose run --rm app before
docker compose run --rm tools verify before
docker compose run --rm app after
docker compose run --rm tools verify after

# Measure afferent coupling (Ca), efferent coupling (Ce), instability (I), and cycles
docker compose run --rm tools measure
docker compose run --rm tools measure all

# Tests: one of them shows the hidden coupling of the before version
docker compose run --rm app tests
```

The outputs go to `output/before/` and `output/after/`. The approved result is in `expected/`.

## Try breaking it

- In the `main` of the `before` version, generate the delinquency report before the charges (change the order
  of the list of reports), rebuild the image with `docker compose build app`, and run `before` and
  `verify before`. The order of the charges changes. Do the same in the `after` version: nothing changes.
- In the `after` version, try to use the internal billing rules (`rules`) from the delinquency module and run
  `measure` again. In Java, the compiler refuses, because the class is not public.
