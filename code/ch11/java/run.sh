#!/bin/sh
# Usage: run.sh in-memory|dual-write|outbox|tests
# versions: in-memory dual-write outbox
set -e
case "$1" in
  in-memory|dual-write|outbox)
    java -cp "target/classes:target/lib/*" morada.Main "$1" "/data/output/$1" ;;
  tests)
    mvn -q -o test && echo "tests OK" ;;
  *)
    echo "usage: in-memory|dual-write|outbox|tests" >&2; exit 1 ;;
esac
