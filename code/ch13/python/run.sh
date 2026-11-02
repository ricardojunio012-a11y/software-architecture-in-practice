#!/bin/sh
# Usage: run.sh online|offline|restart|persisted|tests
# versions: online offline restart persisted
set -e
case "$1" in
  online|offline|restart|persisted)
    python -m morada.main "$1" /data/output ;;
  tests)
    python -m pytest -q tests ;;
  *)
    echo "usage: online|offline|restart|persisted|tests" >&2; exit 1 ;;
esac
