#!/bin/sh
# Usage: run.sh layers|plugins|tests
# versions: layers plugins
set -e
cp="target/classes:target/lib/*"
case "$1" in
  layers)
    java -cp "$cp" morada.layers.Main /data/input/requests.json \
      /data/output/layers ;;
  plugins)
    java -cp "$cp" morada.plugins.Main /data/input/charges.json /app/plugins \
      /data/output/plugins ;;
  tests)
    mvn -q -o test && echo "tests OK" ;;
  *)
    echo "usage: layers|plugins|tests" >&2; exit 1 ;;
esac
