#!/bin/sh
# Usage: run.sh consumer|provider|tests|measure
# versions: consumer provider
set -e
cp="target/classes:target/lib/*"
case "$1" in
  consumer)
    java -cp "$cp" morada.contract.Consumer /data/output ;;
  provider)
    java -cp "$cp" morada.contract.Provider /data/output ;;
  tests)
    mvn -q -o test && echo "tests OK" ;;
  measure)
    # Run time of each layer of the suite, as reported by Maven Surefire (not
    # counting the tool's startup). It varies from machine to machine.
    for layer in Unit Integration EndToEnd; do
      time=$(mvn -o test -Dtest="${layer}Test" | sed -n 's/.*Time elapsed: \([0-9.]* s\).*/\1/p')
      echo "$layer: $time"
    done ;;
  *)
    echo "usage: consumer|provider|tests|measure" >&2; exit 1 ;;
esac
