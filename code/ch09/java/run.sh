#!/bin/sh
# Usage: run.sh http-memory|http-postgres|cli-postgres|tests
# versions: http-memory http-postgres cli-postgres
set -e
java="java -cp target/classes:target/lib/*"
case "$1" in
  http-memory|http-postgres)
    $java morada.main.MainHttp "${1#http-}" "/data/output/$1" ;;
  cli-postgres)
    # One process per command, like a person typing at the terminal
    output=/data/output/cli-postgres
    mkdir -p "$output"
    $java morada.main.MainCli prepare-db >/dev/null
    : >"$output/terminal.txt"
    while read -r line; do
      echo "\$ morada $line" >>"$output/terminal.txt"
      # shellcheck disable=SC2086
      $java morada.main.MainCli $line >>"$output/terminal.txt" || true
    done </data/input/commands.txt
    echo "terminal written to $output" ;;
  tests)
    mvn -q -o test && echo "tests OK" ;;
  *)
    echo "usage: http-memory|http-postgres|cli-postgres|tests" >&2; exit 1 ;;
esac
