#!/bin/sh
# Usage: run.sh naive|saga|resume|compensation|tests
# versions: naive saga resume compensation
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  naive|saga|resume|compensation)
    $node src/onboarding.ts "$1" /data ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: naive|saga|resume|compensation|tests" >&2; exit 1 ;;
esac
