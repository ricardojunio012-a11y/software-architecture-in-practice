#!/bin/sh
# Usage: run.sh online|offline|restart|persisted|tests
# versions: online offline restart persisted
set -e
case "$1" in
  online|offline|restart|persisted)
    java -cp "target/classes:target/lib/*" morada.Main "$1" /data/output ;;
  tests)
    mvn -q -o test && echo "tests OK" ;;
  *)
    echo "usage: online|offline|restart|persisted|tests" >&2; exit 1 ;;
esac
