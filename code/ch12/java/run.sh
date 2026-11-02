#!/bin/sh
# Usage: run.sh monolith|service|contacts|api|health|tests
# versions: monolith service contacts
set -e
cp="target/classes:target/lib/*"
case "$1" in
  monolith|service)
    java -cp "$cp" morada.Main "$1" /data/output ;;
  contacts)
    java -cp "$cp" morada.Contacts /data/output ;;
  api)
    # nodelay: without it, the JDK's built-in HTTP server delays the responses
    exec java -Dsun.net.httpserver.nodelay=true -cp "$cp" morada.Service ;;
  health)
    curl -sf -o /dev/null http://127.0.0.1:8080/health ;;
  tests)
    mvn -q -o test && echo "tests OK" ;;
  *)
    echo "usage: monolith|service|contacts|api|health|tests" >&2; exit 1 ;;
esac
