#!/bin/sh
# Builds the replica: copies the primary and turns on streaming replication, always
# going through Toxiproxy, which is where the lab cuts the network between the two.
set -e
until pg_isready -h toxiproxy -p 5433 -U morada >/dev/null 2>&1; do sleep 1; done
rm -rf "$PGDATA"/*
until PGPASSWORD=replicator pg_basebackup -h toxiproxy -p 5433 -U replicator \
  -D "$PGDATA" -R -X stream
do
  rm -rf "$PGDATA"/*
  sleep 1
done
chown -R postgres:postgres "$PGDATA"
chmod 700 "$PGDATA"
exec gosu postgres postgres
