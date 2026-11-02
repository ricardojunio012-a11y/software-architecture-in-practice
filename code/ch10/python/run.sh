#!/bin/sh
# Usage: run.sh before|after|architecture|tests
set -e
case "$1" in
  before|after)
    python -m "morada.$1.main" /data/input/commands.json "/data/output/$1" ;;
  architecture)
    # The same architecture test on both versions: before must fail, after must pass
    echo "== before"
    if lint-imports --config importlinter-before.ini --no-cache; then
      echo "ERROR: the before version should break the rule"; exit 1
    fi
    echo "== after"
    lint-imports --config importlinter-after.ini --no-cache
    echo "architecture: before breaks the boundary; after keeps it" ;;
  tests)
    python -m pytest -q tests ;;
  *)
    echo "usage: before|after|architecture|tests" >&2; exit 1 ;;
esac
