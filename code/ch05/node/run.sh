#!/bin/sh
# Usage: run.sh bookings|tests
# versions: bookings
set -e
case "$1" in
  bookings)
    node --disable-warning=ExperimentalWarning src/main.ts \
      /data/input/bookings.json /data/output/bookings --today "${TODAY:-2026-03-02}" ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: bookings|tests" >&2; exit 1 ;;
esac
