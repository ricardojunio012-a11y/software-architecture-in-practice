#!/bin/sh
# Tools for the chapter 12 lab.
#   verify monolith|service|contacts   compares output/<version> with the approved result
#   compare                            shows the measurements of both versions side by side
set -e
usage="usage: verify monolith|service|contacts | compare"

case "$1" in
  verify)
    version="$2"
    case "$version" in
      monolith|service|contacts) ;;
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
  compare)
    # Times vary from machine to machine, so they are left out of the verification
    for v in monolith service; do
      echo "== $v"
      cat "output/times-$v.txt"
    done ;;
  *)
    echo "$usage" >&2; exit 1 ;;
esac
