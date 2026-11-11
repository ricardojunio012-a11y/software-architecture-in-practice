#!/bin/sh
# Usage: run.sh naive|erasure|audit-trail|tests
# versions: naive erasure audit-trail
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  naive|erasure|audit-trail)
    $node src/lab.ts "$1" /data ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: naive|erasure|audit-trail|tests" >&2; exit 1 ;;
esac
