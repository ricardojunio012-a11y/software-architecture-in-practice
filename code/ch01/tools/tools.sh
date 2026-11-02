#!/bin/sh
# Tools for the chapter 1 lab.
#   verify stepN         compares output/stepN with the approved result (characterization test)
#   measure [language]   measures the size of the changes between steps (default: $LANGUAGE; "all" measures the four)
set -e

code_folder() {
  case "$1" in
    node) echo "node/src" ;;
    php) echo "php/src" ;;
    python) echo "python/morada" ;;
    java) echo "java/src/main/java/morada" ;;
    *) echo "unknown language: $1" >&2; exit 1 ;;
  esac
}

language_name() {
  case "$1" in
    node) echo "Node/TypeScript" ;;
    php) echo "PHP" ;;
    python) echo "Python" ;;
    java) echo "Java" ;;
  esac
}

# Non-blank lines of a file
lines() { grep -cE '[^[:space:]]' "$1" || true; }

verify() {
  step="$1"
  case "$step" in
    step1|step3) expected="expected/original" ;;
    step2|step4) expected="expected/changes" ;;
    *) echo "usage: verify step1|step2|step3|step4" >&2; exit 1 ;;
  esac
  if [ ! -d "output/$step" ]; then
    echo "output/$step not found: run 'docker compose run --rm app $step' first" >&2
    exit 1
  fi
  if diff -ru "$expected" "output/$step"; then
    echo "OK: the output of $step is identical to the approved result ($expected)."
  else
    echo "FAILED: the output of $step differs from the approved result ($expected)." >&2
    exit 1
  fi
}

# Compares two steps of the same language and prints the size of the change
compare() {
  base="$1/$2"
  new="$1/$3"
  tmp=$(mktemp -d)
  # The step name appears in packages, namespaces and imports; it does not count as a change
  mkdir -p "$tmp/a" "$tmp/b"
  for f in $(cd "$base" && ls); do sed 's/[Ss]tep[0-9]/stepX/g' "$base/$f" > "$tmp/a/$f"; done
  for f in $(cd "$new" && ls); do sed 's/[Ss]tep[0-9]/stepX/g' "$new/$f" > "$tmp/b/$f"; done

  changed=0; added=0; removed=0; new_lines=0
  for f in $(ls "$tmp/b"); do
    if [ -f "$tmp/a/$f" ]; then
      d=$(diff "$tmp/a/$f" "$tmp/b/$f" || true)
      if [ -n "$d" ]; then
        changed=$((changed + 1))
        r=$(printf '%s\n' "$d" | grep -cE '^< .*[^[:space:]]' || true)
        a=$(printf '%s\n' "$d" | grep -cE '^> .*[^[:space:]]' || true)
        removed=$((removed + r)); new_lines=$((new_lines + a))
      fi
    else
      added=$((added + 1))
      new_lines=$((new_lines + $(lines "$tmp/b/$f")))
    fi
  done
  total=0
  for f in $(ls "$tmp/b"); do total=$((total + $(lines "$tmp/b/$f"))); done
  printf '  %s -> %s: %d file(s) changed, %d new; %d existing line(s) changed or removed; %d new line(s); %d lines in total\n' \
    "$2" "$3" "$changed" "$added" "$removed" "$new_lines" "$total"
  rm -rf "$tmp"
}

measure_language() {
  folder=$(code_folder "$1")
  echo "$(language_name "$1")"
  compare "$folder" step1 step2
  compare "$folder" step3 step4
}

measure() {
  target="${1:-$LANGUAGE}"
  if [ "$target" = "all" ]; then
    for l in node php python java; do measure_language "$l"; done
  else
    measure_language "$target"
  fi
}

case "$1" in
  verify) verify "$2" ;;
  measure) measure "$2" ;;
  *) echo "usage: verify stepN | measure [node|php|python|java|all]" >&2; exit 1 ;;
esac
