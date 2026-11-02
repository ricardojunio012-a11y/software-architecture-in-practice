# Chapter 1: the cost of change

Lab for chapter 1 of *Software Architecture in Practice*.

Morada starts as a single function that calculates the monthly dues, creates the invoice and sends the email.
Three change requests arrive: an early-payment discount, card payments and text-message (SMS) notices.
The lab applies the same changes to two versions of the code and measures what each one cost.

| Step | What it is |
|---|---|
| `step1` | The original code: everything in one function |
| `step2` | The original code with the three changes, done the most direct way |
| `step3` | The refactored code: calculation, payment, notification and report separated (same output as step 1) |
| `step4` | The refactored code with the same three changes (same output as step 2) |

## Prerequisite

Docker with Docker Compose. No language needs to be installed.

## Choosing the language

Edit `.env` and set `LANGUAGE` to `node`, `php`, `python` or `java`.

## Walkthrough

```bash
# 1. Generate the charges with the original code
docker compose run --rm app step1

# 2. Check the output against the approved result (characterization test)
docker compose run --rm tools verify step1

# 3. Repeat for the other steps
docker compose run --rm app step2
docker compose run --rm tools verify step2
docker compose run --rm app step3
docker compose run --rm tools verify step3
docker compose run --rm app step4
docker compose run --rm tools verify step4

# 4. Run the unit tests (they exist only for steps 3 and 4)
docker compose run --rm app tests

# 5. Measure the size of the changes (use "all" to compare the four languages)
docker compose run --rm tools measure
docker compose run --rm tools measure all
```

The outputs go to `output/stepN/`. The approved result is in `expected/`.

## Layout

```
input/community.json      data for Garden Court Condominiums (8 units)
expected/original/        approved output of steps 1 and 3
expected/changes/         approved output of steps 2 and 4
tools/                    verification and measurement (shell, runs in a container)
node/  php/  python/  java/   the same code in the four languages
```

## Try breaking it

- In `step1`, change `+ 500000` to `+ 0` in the dues calculation and run `verify step1`: the characterization test points to exactly the lines that changed.
- In `step3`, make the same change in `money` and run `tests`: now a unit test fails and tells you which rule broke.
- Change `TODAY` in `.env` to `2026-03-20` and run `step1`: the interest changes, and the characterization test fails. Why? (The answer is in the chapter text.)
