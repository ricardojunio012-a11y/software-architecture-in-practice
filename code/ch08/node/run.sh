#!/bin/sh
# Usage: run.sh layers|plugins|tests
# versions: layers plugins
set -e
case "$1" in
  layers)
    node --disable-warning=ExperimentalWarning src/layers/main.ts \
      /data/input/requests.json /data/output/layers ;;
  plugins)
    node --disable-warning=ExperimentalWarning src/plugins/main.ts \
      /data/input/charges.json /app/plugins /data/output/plugins ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: layers|plugins|tests" >&2; exit 1 ;;
esac
