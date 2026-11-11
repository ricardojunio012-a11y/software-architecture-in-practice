#!/bin/sh
# Usage: run.sh provision|flow|abandon|cost|tests
# versions: provision flow abandon cost
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  provision)
    $node src/provision.ts /data ;;
  flow)
    $node src/flow.ts /data ;;
  abandon)
    $node src/abandon.ts /data ;;
  cost)
    $node src/cost.ts /data ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: provision|flow|abandon|cost|tests" >&2; exit 1 ;;
esac
