#!/bin/sh
# Usage: run.sh layers|plugins|tests
# versions: layers plugins
set -e
case "$1" in
  layers)
    python -m morada.layers.main /data/input/requests.json /data/output/layers ;;
  plugins)
    python -m morada.plugins.main /data/input/charges.json /app/plugins \
      /data/output/plugins ;;
  tests)
    python -m pytest -q tests ;;
  *)
    echo "usage: layers|plugins|tests" >&2; exit 1 ;;
esac
