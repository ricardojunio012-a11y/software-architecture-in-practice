#!/bin/sh
# Usage: run.sh bookings|tests
# versions: bookings
set -e
case "$1" in
  bookings)
    php src/main.php \
      /data/input/bookings.json /data/output/bookings --today "${TODAY:-2026-03-02}" ;;
  tests)
    vendor/bin/phpunit --colors=always tests ;;
  *)
    echo "usage: bookings|tests" >&2; exit 1 ;;
esac
