#!/bin/sh
# Usage: run.sh bookings|tests
# versions: bookings
set -e
case "$1" in
  bookings)
    java -cp "target/classes:target/lib/*" morada.Main \
      /data/input/bookings.json /data/output/bookings --today "${TODAY:-2026-03-02}" ;;
  tests)
    mvn -q -o test && echo "tests OK" ;;
  *)
    echo "usage: bookings|tests" >&2; exit 1 ;;
esac
