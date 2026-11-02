#!/bin/sh
# Usage: run.sh before|after|tests
set -e
case "$1" in
  before|after)
    java -cp "target/classes:target/lib/*" "morada.$1.Main" \
      /data/input/commands.json "/data/output/$1" ;;
  tests)
    mvn -q -o test && echo "tests OK" ;;
  *)
    echo "usage: before|after|tests" >&2; exit 1 ;;
esac
