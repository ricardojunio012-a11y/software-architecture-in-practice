#!/bin/sh
# Usage: run.sh trace|metrics|slo|tests
# versions: trace metrics slo
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  trace)
    $node src/trace.ts /data ;;
  metrics)
    $node src/metrics.ts /data ;;
  slo)
    $node src/slo.ts /data ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: trace|metrics|slo|tests" >&2; exit 1 ;;
esac
