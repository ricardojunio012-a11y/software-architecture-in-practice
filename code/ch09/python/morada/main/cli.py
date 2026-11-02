# Usage: python -m morada.main.cli <command> [arguments]   (repository in PostgreSQL)
#        python -m morada.main.cli prepare-db              (drops and recreates the table)
# Each run is a new process: the state stays in the database between runs.
import sys

from morada.adapters.inbound.cli import execute
from morada.main.assemble import assemble

args = sys.argv[1:]
prepare = args[:1] == ["prepare-db"]
service, _ = assemble("postgres", prepare)
text, code = ("database ready", 0) if prepare else execute(service, args)
print(text)
sys.exit(code)
