#!/bin/sh
# Usage: run.sh inventory|translation|migration|parallel|decommission|tests
# versions: inventory translation migration parallel decommission
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  inventory|translation|migration|parallel|decommission)
    $node src/main.ts /data "$1" ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: inventory|translation|migration|parallel|decommission|tests" >&2; exit 1 ;;
esac
