#!/bin/sh
# Usage: run.sh before|after|architecture|schemas|tests
set -e
case "$1" in
  before|after)
    node --disable-warning=ExperimentalWarning "src/$1/main.ts" \
      /data/input/commands.json "/data/output/$1" ;;
  architecture)
    # The same architecture test on both versions: before must fail, after must pass
    echo "== before"
    if npx depcruise src/before --config .dependency-cruiser.cjs --output-type err; then
      echo "ERROR: the before version should break the rule"; exit 1
    fi
    echo "== after"
    npx depcruise src/after --config .dependency-cruiser.cjs --output-type err
    echo "architecture: before breaks the boundary; after keeps it" ;;
  schemas)
    # TypeScript only: the database, not an import, blocks the shortcut between modules
    node --disable-warning=ExperimentalWarning src/schemas/main.ts \
      /data/input/commands.json /data/output/schemas ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: before|after|architecture|schemas|tests" >&2; exit 1 ;;
esac
