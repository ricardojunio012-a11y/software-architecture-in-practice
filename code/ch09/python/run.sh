#!/bin/sh
# Usage: run.sh http-memory|http-postgres|cli-postgres|tests
# versions: http-memory http-postgres cli-postgres
set -e
case "$1" in
  http-memory|http-postgres)
    python -m morada.main.http "${1#http-}" "/data/output/$1" ;;
  cli-postgres)
    # One process per command, like a person typing at the terminal
    output=/data/output/cli-postgres
    mkdir -p "$output"
    python -m morada.main.cli prepare-db >/dev/null
    : >"$output/terminal.txt"
    while read -r line; do
      echo "\$ morada $line" >>"$output/terminal.txt"
      # shellcheck disable=SC2086
      python -m morada.main.cli $line >>"$output/terminal.txt" || true
    done </data/input/commands.txt
    echo "terminal written to $output" ;;
  tests)
    python -m pytest -q tests ;;
  *)
    echo "usage: http-memory|http-postgres|cli-postgres|tests" >&2; exit 1 ;;
esac
