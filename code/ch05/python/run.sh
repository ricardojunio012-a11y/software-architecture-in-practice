#!/bin/sh
# Usage: run.sh bookings|tests
# versions: bookings
set -e
case "$1" in
  bookings)
    python -m morada.main \
      /data/input/bookings.json /data/output/bookings --today "${TODAY:-2026-03-02}" ;;
  tests)
    python -m pytest -q tests ;;
  *)
    echo "usage: bookings|tests" >&2; exit 1 ;;
esac
