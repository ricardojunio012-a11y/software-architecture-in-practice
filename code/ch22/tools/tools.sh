#!/bin/sh
# Tools for the chapter 22 lab.
#   verify memory-session|redis-session|crash|algorithms
#       compares output/<version> with the approved result
set -e
usage="usage: verify memory-session|redis-session|crash|algorithms"

case "$1" in
  verify)
    version="$2"
    case "$version" in
      memory-session|redis-session|crash|algorithms) ;;
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
