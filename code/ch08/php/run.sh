#!/bin/sh
# Usage: run.sh layers|plugins|tests
# versions: layers plugins
set -e
case "$1" in
  layers)
    php src/layers/main.php /data/input/requests.json /data/output/layers ;;
  plugins)
    php src/plugins/main.php /data/input/charges.json /app/plugins \
      /data/output/plugins ;;
  tests)
    vendor/bin/phpunit --colors=always tests ;;
  *)
    echo "usage: layers|plugins|tests" >&2; exit 1 ;;
esac
