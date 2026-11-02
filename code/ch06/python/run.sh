#!/bin/sh
# Usage: run.sh step1|...|step7|tests
# versions: step2 step3 step4 step5 step6 step7
set -e
case "$1" in
  step1|step2|step3|step4|step5|step6|step7)
    python -m "morada.$1.main" \
      /data/input/bookings.json "/data/output/$1" --today "${TODAY:-2026-03-02}" ;;
  tests)
    python -m pytest -q tests ;;
  *)
    echo "usage: step1|...|step7|tests" >&2; exit 1 ;;
esac
