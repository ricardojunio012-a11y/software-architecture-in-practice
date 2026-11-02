#!/bin/sh
# Usage: run.sh scenarios|batch|tests
set -e
case "$1" in
  scenarios)
    java -cp "target/classes:target/lib/*" morada.Main /data/scenarios/scenarios.json ;;
  batch)
    java -cp "target/classes:target/lib/*" morada.Batch /data/scenarios/batch.json ;;
  tests)
    mvn -q -o test && echo "tests OK" ;;
  *)
    echo "usage: scenarios|batch|tests" >&2; exit 1 ;;
esac
