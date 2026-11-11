#!/bin/sh
# Builds the candidate: a second replica, which the "promotion" scenario promotes to
# leader in the middle of a partition. After the scenario, the lab creates the "rebuild"
# table on the promoted candidate; this loop notices it, stops the database, erases
# everything and copies the primary again, so the next run starts from a clean replica.
set -e
while true; do
  until pg_isready -h toxiproxy -p 5434 -U morada >/dev/null 2>&1; do sleep 1; done
  rm -rf "$PGDATA"/*
  until PGPASSWORD=replicator pg_basebackup -h toxiproxy -p 5434 -U replicator \
    -D "$PGDATA" -R -X stream
  do
    rm -rf "$PGDATA"/*
    sleep 1
  done
  chown -R postgres:postgres "$PGDATA"
  chmod 700 "$PGDATA"
  gosu postgres postgres &
  until [ "$(PGPASSWORD=morada psql -h 127.0.0.1 -U morada -d morada -tAc \
    "SELECT to_regclass('public.rebuild') IS NOT NULL" 2>/dev/null)" = "t" ]
  do
    sleep 1
  done
  gosu postgres pg_ctl -D "$PGDATA" stop -m fast
  wait
done
