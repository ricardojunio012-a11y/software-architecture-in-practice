#!/bin/sh
# Tools for the chapter 39 lab.
#   verify history|hotspots|coupling|business-case
#       compares output/<version> with the approved result
set -e
usage="usage: verify history|hotspots|coupling|business-case"

case "$1" in
  verify)
    version="$2"
    case "$version" in
      history|hotspots|coupling|business-case) ;;
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
