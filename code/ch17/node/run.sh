#!/bin/sh
# Usage: run.sh leak|noisy|tests
# versions: leak noisy
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  leak)
    $node src/leak.ts /data ;;
  noisy)
    $node src/noisy.ts /data ;;
  tests)
    # One file at a time: the RLS test recreates the database tables
    npx tsc && npx vitest run --no-file-parallelism ;;
  *)
    echo "usage: leak|noisy|tests" >&2; exit 1 ;;
esac
