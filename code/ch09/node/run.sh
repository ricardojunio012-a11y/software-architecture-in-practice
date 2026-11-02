#!/bin/sh
# Usage: run.sh http-memory|http-postgres|cli-postgres|tests
# versions: http-memory http-postgres cli-postgres
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  http-memory|http-postgres)
    $node src/main/http.ts "${1#http-}" "/data/output/$1" ;;
  cli-postgres)
    # One process per command, like a person typing at the terminal
    output=/data/output/cli-postgres
    mkdir -p "$output"
    $node src/main/cli.ts prepare-db >/dev/null
    : >"$output/terminal.txt"
    while read -r line; do
      echo "\$ morada $line" >>"$output/terminal.txt"
      # shellcheck disable=SC2086
      $node src/main/cli.ts $line >>"$output/terminal.txt" || true
    done </data/input/commands.txt
    echo "terminal written to $output" ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: http-memory|http-postgres|cli-postgres|tests" >&2; exit 1 ;;
esac
