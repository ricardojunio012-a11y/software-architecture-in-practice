#!/bin/sh
# Usage: run.sh async|sync|promotion|tests
# versions: async sync promotion
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  async|sync)
    $node src/partition.ts /data "$1" ;;
  promotion)
    $node src/promotion.ts /data ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: async|sync|promotion|tests" >&2; exit 1 ;;
esac
