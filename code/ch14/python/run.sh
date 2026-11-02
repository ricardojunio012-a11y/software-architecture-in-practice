#!/bin/sh
# Usage: run.sh consumer|provider|tests|measure
# versions: consumer provider
set -e
case "$1" in
  consumer)
    python -m morada.contract.consumer /data/output ;;
  provider)
    python -m morada.contract.provider /data/output ;;
  tests)
    python -m pytest -q tests ;;
  measure)
    # Run time of each layer of the suite, as reported by pytest (not counting the
    # tool's startup). It varies from machine to machine.
    for layer in unit integration end_to_end; do
      time=$(python -m pytest -q "tests/test_$layer.py" | sed -n 's/.* in \([0-9.]*s\).*/\1/p')
      echo "$layer: $time"
    done ;;
  *)
    echo "usage: consumer|provider|tests|measure" >&2; exit 1 ;;
esac
