#!/bin/sh
# Usage: run.sh cache-aside|stampede|xfetch|tests
# versions: cache-aside stampede xfetch
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  cache-aside|stampede)
    $node src/scenarios.ts /data "$1" ;;
  xfetch)
    $node src/xfetch.ts /data ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: cache-aside|stampede|xfetch|tests" >&2; exit 1 ;;
esac
