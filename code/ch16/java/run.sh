#!/bin/sh
# Usage: run.sh query|isolation|tests
# versions: query isolation
set -e
cp="target/classes:target/lib/*"
case "$1" in
  query)
    java -cp "$cp" morada.Query /data ;;
  isolation)
    java -cp "$cp" morada.Isolation /data ;;
  tests)
    mvn -q -o test && echo "tests OK" ;;
  *)
    echo "usage: query|isolation|tests" >&2; exit 1 ;;
esac
