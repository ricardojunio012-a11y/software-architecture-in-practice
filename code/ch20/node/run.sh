#!/bin/sh
# Usage: run.sh assistant|evaluation|variation|tests
# versions: assistant evaluation variation
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  assistant)
    $node src/main-assistant.ts /data ;;
  evaluation)
    $node src/main-evaluation.ts /data ;;
  variation)
    $node src/main-variation.ts /data ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: assistant|evaluation|variation|tests" >&2; exit 1 ;;
esac
