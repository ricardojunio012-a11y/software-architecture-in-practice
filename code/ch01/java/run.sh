#!/bin/sh
# Usage: run.sh step1|step2|step3|step4|tests
set -e
case "$1" in
  step1|step2|step3|step4)
    java -cp "target/classes:target/lib/*" "morada.$1.Main" \
      /data/input/community.json "/data/output/$1" --today "${TODAY:-2026-03-02}" ;;
  tests)
    mvn -q -o test && echo "tests OK" ;;
  *)
    echo "usage: step1|step2|step3|step4|tests" >&2; exit 1 ;;
esac
