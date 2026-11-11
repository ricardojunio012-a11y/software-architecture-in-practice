#!/bin/sh
# Usage: run.sh bookings|payment|tests
# versions: bookings payment
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  bookings)
    $node src/bookings.ts /data ;;
  payment)
    $node src/payment.ts /data ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: bookings|payment|tests" >&2; exit 1 ;;
esac
