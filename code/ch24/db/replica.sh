#!/bin/sh
# Builds the read replica: copies the primary with pg_basebackup and turns on streaming
# replication. recovery_min_apply_delay delays applying the changes by 2 seconds on
# purpose, so the replication lag is visible in the lab.
set -e
until pg_isready -h primary -U morada >/dev/null 2>&1; do sleep 1; done
rm -rf "$PGDATA"/*
until PGPASSWORD=replicator pg_basebackup -h primary -U replicator -D "$PGDATA" -R -X stream
do
  rm -rf "$PGDATA"/*
  sleep 1
done
echo "recovery_min_apply_delay = '2s'" >> "$PGDATA/postgresql.auto.conf"
chown -R postgres:postgres "$PGDATA"
chmod 700 "$PGDATA"
exec gosu postgres postgres
