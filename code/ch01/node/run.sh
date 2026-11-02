#!/bin/sh
# Usage: run.sh step1|step2|step3|step4|tests
set -e
case "$1" in
  step1|step2|step3|step4)
    node --disable-warning=ExperimentalWarning "src/$1/main.ts" \
      /data/input/community.json "/data/output/$1" --today "${TODAY:-2026-03-02}" ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: step1|step2|step3|step4|tests" >&2; exit 1 ;;
esac
