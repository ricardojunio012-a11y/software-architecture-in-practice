#!/bin/sh
# Usage: run.sh pitr|disaster|chaos|api|tests
# versions: pitr disaster chaos
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  pitr)
    $node src/pitr.ts /data ;;
  disaster)
    $node src/disaster.ts /data ;;
  chaos)
    $node src/chaos.ts /data ;;
  api)
    exec $node src/api.ts ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: pitr|disaster|chaos|api|tests" >&2; exit 1 ;;
esac
