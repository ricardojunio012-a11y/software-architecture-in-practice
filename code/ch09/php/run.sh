#!/bin/sh
# Usage: run.sh http-memory|http-postgres|cli-postgres|tests
# versions: http-memory http-postgres cli-postgres
set -e
case "$1" in
  http-memory|http-postgres)
    php src/main/http.php "${1#http-}" "/data/output/$1" ;;
  cli-postgres)
    # One process per command, like a person typing at the terminal
    output=/data/output/cli-postgres
    mkdir -p "$output"
    php src/main/cli.php prepare-db >/dev/null
    : >"$output/terminal.txt"
    while read -r line; do
      echo "\$ morada $line" >>"$output/terminal.txt"
      # shellcheck disable=SC2086
      php src/main/cli.php $line >>"$output/terminal.txt" || true
    done </data/input/commands.txt
    echo "terminal written to $output" ;;
  tests)
    vendor/bin/phpunit --colors=always tests ;;
  *)
    echo "usage: http-memory|http-postgres|cli-postgres|tests" >&2; exit 1 ;;
esac
