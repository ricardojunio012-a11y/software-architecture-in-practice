#!/bin/sh
# Usage: run.sh manifests|hpa|function|cost|cloud|tests
# versions: manifests hpa function cost
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  manifests)
    $node src/check.ts /data ;;
  hpa)
    $node src/day5.ts /data ;;
  function)
    $node src/function.ts /data ;;
  cost)
    $node src/cost.ts /data ;;
  cloud)
    $node src/cloud.ts /data ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: manifests|hpa|function|cost|cloud|tests" >&2; exit 1 ;;
esac
