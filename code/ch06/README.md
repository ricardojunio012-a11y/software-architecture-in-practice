# Chapter 6: refactoring and legacy code

Lab for chapter 6 of *Software Architecture in Practice*.

Morada's original bookings module, written in a hurry and without tests, goes through seven steps.
From step 2 on, every step produces exactly the same output:

| Step | What changes |
|---|---|
| `step1` | The original: reads the system clock, uses global state and sends emails through a global client. It cannot be tested |
| `step2` | Only the seams: today's date and the email sender come in as parameters, with the old behavior as the default |
| `step3` | Names and functions: rename variables and extract functions |
| `step4` | Conditionals and constants: guard clauses, named constants, a loop replaced by a pipeline |
| `step5` | Phases and state: decide, format and write kept apart; no global state |
| `step6` | The new rule in the legacy code, without refactoring it: starts from step 2 and adds the monthly limit as a sprout (`limit`) and a log of each run as a wrapper |
| `step7` | The strangler fig: a facade sends the party room to the new code (step 5 plus the sprout) and runs the grill area on both, as an experiment, comparing the answers |

The current behavior, including the Sunday with no weekend surcharge, is protected by
characterization tests (golden master) against the `expected/` folder.

## Prerequisite

Docker with Docker Compose. Choose the language in `.env` (`node`, `php`, `python` or `java`).

## Walkthrough

```bash
# The original: with today's clock, every March request is declined
docker compose run --rm app step1
docker compose run --rm tools verify step1

# From step 2 on, the output is identical to the approved result
docker compose run --rm app step2
docker compose run --rm tools verify step2

# Characterization tests
docker compose run --rm app tests

# The new rule with a sprout and a wrapper, and the strangler with an experiment
docker compose run --rm app step6
docker compose run --rm tools verify step6
docker compose run --rm app step7
docker compose run --rm tools verify step7

# Size of each refactoring step (the last line compares step 2 with step 6)
docker compose run --rm tools measure
docker compose run --rm tools measure all
```

## Try it

- Add to the input a party room request for A-101 on 2026-03-28 and run step 6: it is
  declined by the monthly limit. Undo the change.
- Swap the routes in step 7 (party room in the experiment, grill area on the new code): the
  output does not change.
- Fix the Sunday in step 5 (replace `isSaturday` with `isWeekend`) and run step 7 before
  anything else: the experiment reports the difference in R-05 (100.00 in the old code, 110.00
  in the new one), and the step 7 verification still passes, because the old code answered.
  Then watch the tests fail, update the test and the approved result, and record the fix in a
  separate commit.
