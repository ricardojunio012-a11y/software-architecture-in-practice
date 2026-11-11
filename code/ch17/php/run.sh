#!/bin/sh
# Usage: run.sh leak|noisy|tests
# versions: leak noisy
set -e
case "$1" in
  leak)
    php src/leak.php /data ;;
  noisy)
    php src/noisy.php /data ;;
  tests)
    vendor/bin/phpunit --colors=always tests ;;
  *)
    echo "usage: leak|noisy|tests" >&2; exit 1 ;;
esac
