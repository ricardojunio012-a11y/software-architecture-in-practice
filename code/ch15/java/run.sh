#!/bin/sh
# Usage: run.sh api|compatibility|tests
# versions: api compatibility
set -e
cp="target/classes:target/lib/*"
case "$1" in
  api)
    java -cp "$cp" morada.Script /data ;;
  compatibility)
    java -cp "$cp" morada.Proposals /data ;;
  tests)
    mvn -q -o test && echo "tests OK" ;;
  *)
    echo "usage: api|compatibility|tests" >&2; exit 1 ;;
esac
