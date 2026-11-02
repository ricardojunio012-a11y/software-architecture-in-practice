#!/bin/sh
# Tools for the chapter 3 lab.
#   verify before|after    compares output/<version> with the approved result
#   measure [language]     measures coupling and cycles (default: $LANGUAGE; "all" measures the four)
set -e

case "$1" in
  verify)
    version="$2"
    case "$version" in
      before|after) ;;
      *) echo "usage: verify before|after" >&2; exit 1 ;;
    esac
    if [ ! -d "output/$version" ]; then
      echo "output/$version not found: run 'docker compose run --rm app $version' first" >&2
      exit 1
    fi
    if diff -ru expected "output/$version"; then
      echo "OK: the output of $version is identical to the approved result."
    else
      echo "FAILED: the output of $version differs from the approved result." >&2
      exit 1
    fi ;;
  measure)
    python3 tools/dependencies.py "${2:-$LANGUAGE}" ;;
  *)
    echo "usage: verify before|after | measure [node|php|python|java|all]" >&2; exit 1 ;;
esac
