#!/bin/sh
# Usage: run.sh before|after|tests
set -e
case "$1" in
  before|after)
    python -m "morada.$1.main" /data/input/community.json "/data/output/$1" --today "${TODAY:-2026-03-02}" ;;
  tests)
    python -m pytest -q tests ;;
  *)
    echo "usage: before|after|tests" >&2; exit 1 ;;
esac
