#!/bin/sh
# Usage: run.sh resilience|layers|tests
# versions: resilience layers
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  resilience)
    $node src/resilience.ts /data ;;
  layers)
    $node src/layers.ts /data ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: resilience|layers|tests" >&2; exit 1 ;;
esac
