#!/bin/sh
# Usage: run.sh realtime|offline|restart|tests
# versions: realtime offline restart
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  realtime)
    $node src/realtime.ts /data ;;
  offline)
    $node src/offline.ts /data ;;
  restart)
    $node src/restart.ts /data ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: realtime|offline|restart|tests" >&2; exit 1 ;;
esac
