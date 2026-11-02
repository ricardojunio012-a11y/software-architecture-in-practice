#!/bin/sh
# Usage: run.sh scenarios|batch|tests
set -e
case "$1" in
  scenarios)
    python -m morada.main /data/scenarios/scenarios.json ;;
  batch)
    python -m morada.batch /data/scenarios/batch.json ;;
  tests)
    python -m pytest -q tests ;;
  *)
    echo "usage: scenarios|batch|tests" >&2; exit 1 ;;
esac
