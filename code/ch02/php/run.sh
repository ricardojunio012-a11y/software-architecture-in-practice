#!/bin/sh
# Usage: run.sh scenarios|batch|tests
set -e
case "$1" in
  scenarios)
    php src/main.php /data/scenarios/scenarios.json ;;
  batch)
    php src/batch.php /data/scenarios/batch.json ;;
  tests)
    vendor/bin/phpunit --colors=always tests ;;
  *)
    echo "usage: scenarios|batch|tests" >&2; exit 1 ;;
esac
