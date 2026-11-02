#!/bin/sh
# Usage: run.sh online|offline|restart|persisted|tests
# versions: online offline restart persisted
set -e
case "$1" in
  online|offline|restart|persisted)
    node --disable-warning=ExperimentalWarning src/main.ts "$1" /data/output ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: online|offline|restart|persisted|tests" >&2; exit 1 ;;
esac
