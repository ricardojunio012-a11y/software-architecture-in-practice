#!/bin/sh
# Usage: run.sh elt|tests
# versions: elt
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  elt)
    $node src/pipeline.ts /data ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: elt|tests" >&2; exit 1 ;;
esac
