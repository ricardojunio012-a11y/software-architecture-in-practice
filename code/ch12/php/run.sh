#!/bin/sh
# Usage: run.sh monolith|service|contacts|api|health|tests
# versions: monolith service contacts
set -e
case "$1" in
  monolith|service)
    php src/main.php "$1" /data/output ;;
  contacts)
    php src/contacts.php /data/output ;;
  api)
    # PHP's built-in HTTP server: fine for the lab, not for production
    exec php -S 0.0.0.0:8080 src/service.php ;;
  health)
    wget -q -O /dev/null http://127.0.0.1:8080/health ;;
  tests)
    vendor/bin/phpunit --colors=always tests ;;
  *)
    echo "usage: monolith|service|contacts|api|health|tests" >&2; exit 1 ;;
esac
