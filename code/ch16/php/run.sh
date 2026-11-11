#!/bin/sh
# Usage: run.sh query|isolation|tests
# versions: query isolation
set -e
case "$1" in
  query)
    php src/query.php /data ;;
  isolation)
    php src/isolation.php /data ;;
  tests)
    vendor/bin/phpunit --colors=always tests ;;
  *)
    echo "usage: query|isolation|tests" >&2; exit 1 ;;
esac
