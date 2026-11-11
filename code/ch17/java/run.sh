#!/bin/sh
# Usage: run.sh leak|noisy|tests
# versions: leak noisy
set -e
cp="target/classes:target/lib/*"
case "$1" in
  leak)
    java -cp "$cp" morada.Leak /data ;;
  noisy)
    java -cp "$cp" morada.Noisy /data ;;
  tests)
    mvn -q -o test && echo "tests OK" ;;
  *)
    echo "usage: leak|noisy|tests" >&2; exit 1 ;;
esac
