#!/bin/sh
# Usage: run.sh before|after|architecture|tests
set -e
case "$1" in
  before|after)
    php "src/$1/main.php" /data/input/commands.json "/data/output/$1" ;;
  architecture)
    # The same architecture test on both versions: before must fail, after must pass
    echo "== before"
    if vendor/bin/deptrac analyse --config-file=deptrac-before.yaml --no-progress; then
      echo "ERROR: the before version should break the rule"; exit 1
    fi
    echo "== after"
    vendor/bin/deptrac analyse --config-file=deptrac-after.yaml --no-progress
    echo "architecture: before breaks the boundary; after keeps it" ;;
  tests)
    vendor/bin/phpunit --colors=always tests ;;
  *)
    echo "usage: before|after|architecture|tests" >&2; exit 1 ;;
esac
