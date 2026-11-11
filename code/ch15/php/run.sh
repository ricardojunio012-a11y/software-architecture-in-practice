#!/bin/sh
# Usage: run.sh api|compatibility|tests
# versions: api compatibility
set -e

# Starts the API on PHP's built-in server, with four processes to handle
# simultaneous requests, and waits for it to respond
start_api() {
  PHP_CLI_SERVER_WORKERS=4 php -S 127.0.0.1:8080 public/index.php >/dev/null 2>&1 &
  until php -r 'exit(@fsockopen("127.0.0.1", 8080) ? 0 : 1);'; do sleep 0.1; done
}

case "$1" in
  api)
    start_api
    php src/script.php /data http://127.0.0.1:8080 ;;
  compatibility)
    php src/proposals.php /data ;;
  tests)
    start_api
    API_URL=http://127.0.0.1:8080 vendor/bin/phpunit --colors=always tests ;;
  *)
    echo "usage: api|compatibility|tests" >&2; exit 1 ;;
esac
