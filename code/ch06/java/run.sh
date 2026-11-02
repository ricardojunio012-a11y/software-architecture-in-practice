#!/bin/sh
# Usage: run.sh step1|...|step7|tests
# versions: step2 step3 step4 step5 step6 step7
set -e
case "$1" in
  step1|step2|step3|step4|step5|step6|step7)
    java -cp "target/classes:target/lib/*" "morada.$1.Main" \
      /data/input/bookings.json "/data/output/$1" --today "${TODAY:-2026-03-02}" ;;
  tests)
    mvn -q -o test && echo "tests OK" ;;
  *)
    echo "usage: step1|...|step7|tests" >&2; exit 1 ;;
esac
