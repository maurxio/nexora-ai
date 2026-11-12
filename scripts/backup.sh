#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
backup_dir=${BACKUP_DIR:-./backups}
mkdir -p "$backup_dir"
archive="$backup_dir/postgres-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose --env-file "${APP_ENV_FILE:-.env.production}" -f docker-compose.prod.yml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$archive.tmp"
test -s "$archive.tmp"
mv "$archive.tmp" "$archive"
find "$backup_dir" -name 'postgres-*.dump' -type f -mtime +14 -delete
printf '%s\n' "$archive"
