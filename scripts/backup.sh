#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
backup_dir=${BACKUP_DIR:-./backups}
mkdir -p "$backup_dir"
exec 8> "$backup_dir/.backup.lock"
flock -n 8 || { echo 'Another backup is running' >&2; exit 1; }
archive_tmp=$(mktemp "$backup_dir/postgres-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX.dump.tmp")
archive=${archive_tmp%.tmp}
trap 'rm -f "$archive_tmp"' EXIT
docker compose --env-file "${APP_ENV_FILE:-.env.production}" -f docker-compose.prod.yml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$archive_tmp"
test -s "$archive_tmp"
mv "$archive_tmp" "$archive"
find "$backup_dir" -name 'postgres-*.dump' -type f -mtime +14 -delete
printf '%s\n' "$archive"
