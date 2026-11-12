#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
archive=${1:?Usage: restore.sh archive.dump target_database}
target_database=${2:?Explicit target database required}
[[ "$target_database" =~ ^[a-zA-Z_][a-zA-Z0-9_]*_restore$ ]] || { echo 'Target must end in _restore (never overwrite live data)'; exit 1; }
compose=(docker compose --env-file "${APP_ENV_FILE:-.env.production}" -f docker-compose.prod.yml)
"${compose[@]}" exec -T postgres sh -c 'createdb -U "$POSTGRES_USER" "$1"' sh "$target_database"
"${compose[@]}" exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$1" --exit-on-error --no-owner --no-privileges' sh "$target_database" < "$archive"
printf 'SELECT count(*) FROM "_prisma_migrations";\n' | "${compose[@]}" exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$1" -v ON_ERROR_STOP=1' sh "$target_database"
