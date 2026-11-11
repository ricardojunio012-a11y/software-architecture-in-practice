#!/bin/sh
# Starts PostgreSQL with continuous WAL archiving on. The archive_command refuses to
# overwrite a file that already exists, as the documentation recommends.
# archive_timeout=0: a segment is archived only when it fills up or when someone asks
# (pg_switch_wal), which keeps the RPO of the "disaster" scenario predictable.
set -e
mkdir -p /archive
chown postgres:postgres /archive
exec docker-entrypoint.sh postgres \
  -c wal_level=replica \
  -c archive_mode=on \
  -c "archive_command=test ! -f /archive/%f && cp %p /archive/%f" \
  -c archive_timeout=0
