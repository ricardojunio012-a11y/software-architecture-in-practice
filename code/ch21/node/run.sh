#!/bin/sh
# Usage: run.sh n1|fixed|tests
# versions: n1 fixed
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  n1|fixed)
    $node src/load.ts /data "$1" ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: n1|fixed|tests" >&2; exit 1 ;;
esac
