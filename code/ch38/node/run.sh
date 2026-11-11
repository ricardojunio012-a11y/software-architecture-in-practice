#!/bin/sh
# Usage: run.sh log|defects|fitness|tests
# versions: log defects fitness
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  log)
    $node src/log.ts /data log decisions ;;
  defects)
    # the validator exits with code 1 when it finds problems, as it must in the pipeline
    $node src/log.ts /data defects decisions-with-defects ||
      echo "(the validator exited with code 1)" ;;
  fitness)
    $node src/pipeline.ts /data ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: log|defects|fitness|tests" >&2; exit 1 ;;
esac
