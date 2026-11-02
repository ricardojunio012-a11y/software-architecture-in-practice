#!/bin/sh
# Usage: run.sh before|after|tests
set -e
case "$1" in
  before|after)
    java -cp "target/classes:target/lib/*" "morada.$1.Main" \
      /data/input/community.json "/data/output/$1" --today "${TODAY:-2026-03-02}" ;;
  tests)
    mvn -q -o test && echo "tests OK" ;;
  *)
    echo "usage: before|after|tests" >&2; exit 1 ;;
esac
