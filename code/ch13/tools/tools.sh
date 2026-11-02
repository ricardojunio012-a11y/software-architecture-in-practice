#!/bin/sh
# Tools for the chapter 13 lab.
#   verify online|offline|restart|persisted
#       compares output/<version> with the approved result
set -e
usage="usage: verify online|offline|restart|persisted"

case "$1" in
  verify)
    version="$2"
    case "$version" in
      online|offline|restart|persisted) ;;
      *) echo "$usage" >&2; exit 1 ;;
    esac
    if [ ! -d "output/$version" ]; then
      echo "output/$version not found: run 'docker compose run --rm app $version' first" >&2
      exit 1
    fi
    if diff -ru "expected/$version" "output/$version"; then
      echo "OK: the output of $version is identical to the approved result."
    else
      echo "FAILED: the output of $version differs from the approved result." >&2
      exit 1
    fi ;;
  *)
    echo "$usage" >&2; exit 1 ;;
esac
