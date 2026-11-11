#!/bin/sh
# Usage: run.sh idor|fixed|secrets|tests
# versions: idor fixed secrets
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  idor|fixed)
    $node src/script.ts "$1" /data ;;
  secrets)
    $node src/secrets.ts /data ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: idor|fixed|secrets|tests" >&2; exit 1 ;;
esac
