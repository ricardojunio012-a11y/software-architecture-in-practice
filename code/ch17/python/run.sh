#!/bin/sh
# Usage: run.sh leak|noisy|tests
# versions: leak noisy
set -e
case "$1" in
  leak)
    python -m morada.leak /data ;;
  noisy)
    python -m morada.noisy /data ;;
  tests)
    python -m pytest -q tests ;;
  *)
    echo "usage: leak|noisy|tests" >&2; exit 1 ;;
esac
