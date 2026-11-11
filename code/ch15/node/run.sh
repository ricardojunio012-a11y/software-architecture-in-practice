#!/bin/sh
# Usage: run.sh api|compatibility|tests
# versions: api compatibility
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  api)
    $node src/script.ts /data ;;
  compatibility)
    $node src/proposals.ts /data ;;
  tests)
    # One file at a time: the integration test recreates the database tables
    npx tsc && npx vitest run --no-file-parallelism ;;
  *)
    echo "usage: api|compatibility|tests" >&2; exit 1 ;;
esac
