#!/bin/sh
# Usage: run.sh consumer|provider|tests|measure
# versions: consumer provider
set -e
case "$1" in
  consumer)
    php src/contract/consumer.php /data/output ;;
  provider)
    php src/contract/provider.php /data/output ;;
  tests)
    vendor/bin/phpunit --colors=always tests ;;
  measure)
    # Run time of each layer of the suite, as reported by PHPUnit (not counting the
    # tool's startup). It varies from machine to machine.
    for layer in Unit Integration EndToEnd; do
      time=$(vendor/bin/phpunit "tests/${layer}Test.php" | sed -n 's/^Time: \(.*\), Memory.*/\1/p')
      echo "$layer: $time"
    done ;;
  *)
    echo "usage: consumer|provider|tests|measure" >&2; exit 1 ;;
esac
