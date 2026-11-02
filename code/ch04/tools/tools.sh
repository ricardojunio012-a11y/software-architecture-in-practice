#!/bin/sh
# Tools for the chapter 4 lab.
#   verify before|after   compares output/<version> with the approved result for $GATEWAY
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
    if diff -ru "expected/$GATEWAY" "output/$version"; then
      echo "OK: the output of $version is identical to the approved result ($GATEWAY)."
    else
      echo "FAILED: the output of $version differs from the approved result ($GATEWAY)." >&2
      exit 1
    fi ;;
  *)
    echo "usage: verify before|after" >&2; exit 1 ;;
esac
