#!/bin/sh
# Usage: run.sh pipeline|rename|expand|shortcut|infra|tests
# versions: pipeline rename expand shortcut infra
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  pipeline)
    $node src/pipeline.ts /data ;;
  rename|expand|shortcut)
    $node src/columns/deployments.ts /data "$1" ;;
  infra)
    $node src/infra.ts /data ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: pipeline|rename|expand|shortcut|infra|tests" >&2; exit 1 ;;
esac
