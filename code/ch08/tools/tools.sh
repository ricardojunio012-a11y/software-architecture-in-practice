#!/bin/sh
# Tools for the chapter 8 lab.
#   verify layers|plugins   compares output/<part> with the approved result
set -e

case "$1" in
  verify)
    part="$2"
    case "$part" in
      layers|plugins) ;;
      *) echo "usage: verify layers|plugins" >&2; exit 1 ;;
    esac
    if [ ! -d "output/$part" ]; then
      echo "output/$part not found: run 'docker compose run --rm app $part' first" >&2
      exit 1
    fi
    if diff -ru "expected/$part" "output/$part"; then
      echo "OK: the output of $part is identical to the approved result."
    else
      echo "FAILED: the output of $part differs from the approved result." >&2
      exit 1
    fi ;;
  *)
    echo "usage: verify layers|plugins" >&2; exit 1 ;;
esac
