#!/bin/sh

set -eu

API_DIR="/opt/norder/API/norder-crm-api"
BACKUP_DIR="/opt/norder/backups"
COMPOSE_FILE="$API_DIR/deploy/compose.production.yml"
ENV_FILE="$API_DIR/deploy/.env"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

umask 077
mkdir -p "$BACKUP_DIR"

timestamp="$(TZ=America/Merida date '+%Y-%m-%d_%H-%M-%S-America_Merida')"
dump_file="$BACKUP_DIR/norder-production-auto-$timestamp.dump"
partial_dump="$dump_file.partial"
list_file="$dump_file.list"
partial_list="$list_file.partial"

cleanup() {
  rm -f "$partial_dump" "$partial_list"
}
trap cleanup EXIT HUP INT TERM

cd "$API_DIR"

docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  exec -T database \
  sh -lc 'pg_dump --format=custom --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  > "$partial_dump"

test -s "$partial_dump"

docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  exec -T database \
  pg_restore --list \
  < "$partial_dump" \
  > "$partial_list"

test -s "$partial_list"

mv "$partial_dump" "$dump_file"
mv "$partial_list" "$list_file"
sha256sum "$dump_file" > "$dump_file.sha256"

find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'norder-production-auto-*.dump' \
     -o -name 'norder-production-auto-*.dump.list' \
     -o -name 'norder-production-auto-*.dump.sha256' \) \
  -mtime "+$RETENTION_DAYS" -delete

printf 'Backup verificado: %s\n' "$dump_file"

