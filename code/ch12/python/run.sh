#!/bin/sh
# Usage: run.sh monolith|service|contacts|api|health|tests
# versions: monolith service contacts
set -e
case "$1" in
  monolith|service)
    python -m morada.main "$1" /data/output ;;
  contacts)
    python -m morada.contacts /data/output ;;
  api)
    exec python -m morada.service ;;
  health)
    python -c "import urllib.request as u; u.urlopen('http://127.0.0.1:8080/health', timeout=2)" ;;
  tests)
    python -m pytest -q tests ;;
  *)
    echo "usage: monolith|service|contacts|api|health|tests" >&2; exit 1 ;;
esac
