#!/bin/sh
# Usage: run.sh unit|growth|cfo|commitment|tests
# versions: unit growth cfo commitment
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  unit|growth|cfo|commitment)
    $node "src/$1.ts" /data ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: unit|growth|cfo|commitment|tests" >&2; exit 1 ;;
esac
