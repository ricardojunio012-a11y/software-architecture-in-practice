#!/bin/sh
# Usage: run.sh query|isolation|tests
# versions: query isolation
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  query)
    $node src/query.ts /data ;;
  isolation)
    $node src/isolation.ts /data ;;
  tests)
    # One file at a time: the tests recreate the database schema
    npx tsc && npx vitest run --no-file-parallelism ;;
  *)
    echo "usage: query|isolation|tests" >&2; exit 1 ;;
esac
