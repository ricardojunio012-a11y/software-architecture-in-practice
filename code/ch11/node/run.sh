#!/bin/sh
# Usage: run.sh in-memory|dual-write|outbox|tests
# versions: in-memory dual-write outbox
set -e
case "$1" in
  in-memory|dual-write|outbox)
    node --disable-warning=ExperimentalWarning src/main.ts "$1" "/data/output/$1" ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: in-memory|dual-write|outbox|tests" >&2; exit 1 ;;
esac
