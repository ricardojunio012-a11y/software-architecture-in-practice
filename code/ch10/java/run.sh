#!/bin/sh
# Usage: run.sh before|after|architecture|tests
set -e
cp="target/classes:target/lib/*"
case "$1" in
  before|after)
    java -cp "$cp" "morada.$1.Main" /data/input/commands.json "/data/output/$1" ;;
  architecture)
    # The same architecture test on both versions: before must fail, after must pass
    echo "== before"
    if java -cp "$cp" morada.Architecture before; then
      echo "ERROR: the before version should break the rule"; exit 1
    fi
    echo "== after"
    java -cp "$cp" morada.Architecture after
    echo "architecture: before breaks the boundary; after keeps it" ;;
  tests)
    mvn -q -o test && echo "tests OK" ;;
  *)
    echo "usage: before|after|architecture|tests" >&2; exit 1 ;;
esac
