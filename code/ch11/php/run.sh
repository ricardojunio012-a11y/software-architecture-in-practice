#!/bin/sh
# Usage: run.sh in-memory|dual-write|outbox|tests
# versions: in-memory dual-write outbox
set -e
case "$1" in
  in-memory|dual-write|outbox)
    php src/main.php "$1" "/data/output/$1" ;;
  tests)
    vendor/bin/phpunit --colors=always tests ;;
  *)
    echo "usage: in-memory|dual-write|outbox|tests" >&2; exit 1 ;;
esac
