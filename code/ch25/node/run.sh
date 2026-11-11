#!/bin/sh
# Usage: run.sh queue|pressure|tests
# versions: queue pressure
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  queue|pressure)
    $node src/main.ts /data "$1" ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: queue|pressure|tests" >&2; exit 1 ;;
esac
