#!/bin/sh
# Usage: run.sh replica|partition|sharding|tests
# versions: replica partition sharding
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  replica)
    $node src/replica.ts /data ;;
  partition)
    $node src/partition.ts /data ;;
  sharding)
    $node src/sharding.ts /data ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: replica|partition|sharding|tests" >&2; exit 1 ;;
esac
