#!/bin/sh
# Tools for the chapter 5 lab.
#   verify bookings   compares output/bookings with the approved result
set -e

case "$1" in
  verify)
    if [ ! -d output/bookings ]; then
      echo "output/bookings not found: run 'docker compose run --rm app bookings' first" >&2
      exit 1
    fi
    if diff -ru expected output/bookings; then
      echo "OK: the output is identical to the approved result."
    else
      echo "FAILED: the output differs from the approved result." >&2
      exit 1
    fi ;;
  *)
    echo "usage: verify bookings" >&2; exit 1 ;;
esac
