#!/bin/sh
# Usage: run.sh webhook|nacha|tests
# versions: webhook nacha
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  webhook)
    $node src/webhook/main.ts /data ;;
  nacha)
    $node src/nacha/main.ts /data ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: webhook|nacha|tests" >&2; exit 1 ;;
esac
