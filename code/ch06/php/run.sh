#!/bin/sh
# Usage: run.sh step1|...|step7|tests
# versions: step2 step3 step4 step5 step6 step7
set -e
case "$1" in
  step1|step2|step3|step4|step5|step6|step7)
    php "src/$1/main.php" \
      /data/input/bookings.json "/data/output/$1" --today "${TODAY:-2026-03-02}" ;;
  tests)
    vendor/bin/phpunit --colors=always tests ;;
  *)
    echo "usage: step1|...|step7|tests" >&2; exit 1 ;;
esac
