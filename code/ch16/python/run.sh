#!/bin/sh
# Usage: run.sh query|isolation|tests
# versions: query isolation
set -e
case "$1" in
  query)
    python -m morada.query /data ;;
  isolation)
    python -m morada.isolation /data ;;
  tests)
    python -m pytest -q tests ;;
  *)
    echo "usage: query|isolation|tests" >&2; exit 1 ;;
esac
