#!/bin/sh
# Usage: run.sh monolith|service|contacts|api|health|tests
# versions: monolith service contacts
set -e
node="node --disable-warning=ExperimentalWarning"
case "$1" in
  monolith|service)
    $node src/main.ts "$1" /data/output ;;
  contacts)
    $node src/contacts.ts /data/output ;;
  api)
    exec $node src/service.ts ;;
  health)
    wget -q -O /dev/null http://127.0.0.1:8080/health ;;
  tests)
    npx tsc && npx vitest run ;;
  *)
    echo "usage: monolith|service|contacts|api|health|tests" >&2; exit 1 ;;
esac
