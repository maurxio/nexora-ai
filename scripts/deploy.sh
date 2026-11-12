#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
exec 9> /tmp/nexora-deploy.lock
flock -n 9 || { echo 'Another deployment is running'; exit 1; }
compose=(docker compose --env-file "${APP_ENV_FILE:-.env.production}" -f docker-compose.prod.yml)
"${compose[@]}" config --quiet
"${compose[@]}" pull
"${compose[@]}" up -d --wait postgres redis
if "${compose[@]}" exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "$1"' sh "SELECT 1 FROM information_schema.tables WHERE table_name = '_prisma_migrations'" | grep -q 1; then
  bash scripts/backup.sh
fi
"${compose[@]}" run --rm migrate
"${compose[@]}" up -d --wait --wait-timeout 180
"${compose[@]}" exec -T api node -e "fetch('http://localhost:3000/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
