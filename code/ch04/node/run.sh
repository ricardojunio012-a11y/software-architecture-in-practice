#!/bin/sh
# Usage: run.sh before|after|tests
set -e
case "$1" in
  before|after)
    node --disable-warning=ExperimentalWarning "src/$1/main.ts" \
      /data/input/community.json "/data/output/$1" --today "${TODAY:-2026-03-02}" ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: before|after|tests" >&2; exit 1 ;;
esac
