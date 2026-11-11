#!/bin/sh
# Usage: run.sh api|compatibility|tests
# versions: api compatibility
set -e
case "$1" in
  api)
    python -m morada.script /data ;;
  compatibility)
    python -m morada.proposals /data ;;
  tests)
    python -m pytest -q tests ;;
  *)
    echo "usage: api|compatibility|tests" >&2; exit 1 ;;
esac
