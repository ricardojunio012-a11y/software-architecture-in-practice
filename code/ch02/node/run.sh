#!/bin/sh
# Usage: run.sh scenarios|batch|tests
set -e
case "$1" in
  scenarios)
    node --disable-warning=ExperimentalWarning src/main.ts /data/scenarios/scenarios.json ;;
  batch)
    node --disable-warning=ExperimentalWarning src/batch.ts /data/scenarios/batch.json ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: scenarios|batch|tests" >&2; exit 1 ;;
esac
