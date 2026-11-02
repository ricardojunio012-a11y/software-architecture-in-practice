#!/bin/sh
# Usage: run.sh before|after|tests
set -e
case "$1" in
  before|after)
    php "src/$1/main.php" /data/input/commands.json "/data/output/$1" ;;
  tests)
    vendor/bin/phpunit --colors=always tests ;;
  *)
    echo "usage: before|after|tests" >&2; exit 1 ;;
esac
