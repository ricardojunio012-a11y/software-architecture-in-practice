# Chapter 4: SOLID and GRASP

Lab for chapter 4 of *Software Architecture in Practice*.

Morada's charge issuing calculates the charge of each unit (monthly dues, reserve fund,
board president exemption, past-due balance, late fee, interest and early-payment discount)
and registers each one with a payment provider. The lab has two versions with the same output:

| Version | How it is organized |
|---|---|
| `before` | One function with every rule in chained ifs, which calls the Alpha Bank SDK in the middle of the calculation |
| `after` | One class per rule behind the `Rule` interface, a calculator closed for modification, issuing that depends on the `PaymentGateway` interface and one adapter per provider, all assembled in `main` (the composition root) |

The Alpha Bank (invoices paid by ACH) and EasyPay (card payments) SDKs are simulated in
`external/`: no data leaves your machine.

## Prerequisite

Docker with Docker Compose. Choose the language (`node`, `php`, `python` or `java`) and the
gateway (`alpha` or `easypay`) in `.env`.

## Walkthrough

```bash
# Issue with each version and check against the approved result for the gateway in .env
docker compose run --rm app before
docker compose run --rm tools verify before
docker compose run --rm app after
docker compose run --rm tools verify after

# Tests: one of them shows that the before version cannot calculate without creating invoices
docker compose run --rm app tests
```

The outputs go to `output/before/` and `output/after/` (`charges.txt` and
`registrations.txt`). The approved results are in `expected/alpha/` and `expected/easypay/`.

## Try it

- Set `GATEWAY=easypay` in `.env` and run `after` and `verify after`: the charges are the
  same and the registrations become card payments. Run `before` and `verify before`: it fails,
  because the bank is hard-coded.
- Create a new rule, for example a special assessment of $50.00 per unit, as a class that
  implements `Rule`, and add it to the list in `main`. No other class changes; the new line
  shows up in the report on its own.
