#!/bin/sh
# Usage: run.sh before|after|tests
set -e
case "$1" in
  before|after)
    node --disable-warning=ExperimentalWarning "src/$1/main.ts" \
      /data/input/commands.json "/data/output/$1" ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: before|after|tests" >&2; exit 1 ;;
esac
