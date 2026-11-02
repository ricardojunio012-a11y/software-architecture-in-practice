#!/bin/sh
# Usage: run.sh consumer|provider|tests|measure
# versions: consumer provider
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  consumer)
    $node src/contract/consumer.ts /data/output ;;
  provider)
    $node src/contract/provider.ts /data/output ;;
  tests)
    # One file at a time: the integration tests share the same database
    npx tsc && npx vitest run --no-file-parallelism ;;
  measure)
    # Run time of each layer of the suite, as reported by vitest (not counting the
    # tool's startup). It varies from machine to machine.
    for layer in unit integration end-to-end; do
      time=$(NO_COLOR=1 npx vitest run "test/$layer.test.ts" |
        sed -n 's/.*tests \([0-9.]*m\{0,1\}s\).*/\1/p')
      echo "$layer: $time"
    done ;;
  *)
    echo "usage: consumer|provider|tests|measure" >&2; exit 1 ;;
esac
