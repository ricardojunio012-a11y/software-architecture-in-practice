#!/bin/sh
# Usage: run.sh memory-session|redis-session|crash|algorithms|tests
# versions: memory-session redis-session crash algorithms
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  memory-session|redis-session|crash)
    $node src/scenarios.ts /data "$1" ;;
  algorithms)
    $node src/algorithms.ts /data ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: memory-session|redis-session|crash|algorithms|tests" >&2; exit 1 ;;
esac
