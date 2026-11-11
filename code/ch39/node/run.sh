#!/bin/sh
# Usage: run.sh history|hotspots|coupling|business-case|tests
#        run.sh analyze /path/to/a/repository   (your own repository)
# versions: history hotspots coupling business-case
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  history|hotspots|coupling|business-case)
    $node src/main.ts "$1" /data/output ;;
  analyze)
    $node src/main.ts analyze "${2:?give the path to the repository}" ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: history|hotspots|coupling|business-case|analyze <repo>|tests" >&2
    exit 1 ;;
esac
