#!/bin/sh
# Runs on the primary's first start: creates the replication user and allows the
# replication connection from the Compose network.
set -e
psql -v ON_ERROR_STOP=1 -U morada -d morada -c \
  "CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'replicator';"
echo "host replication replicator all scram-sha-256" >> "$PGDATA/pg_hba.conf"
