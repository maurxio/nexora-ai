#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
smoke_dir=$(mktemp -d)
smoke_project="nexora-smoke-$$"
export POSTGRES_USER=nexora POSTGRES_DB=nexora
export APP_ENV_FILE="$smoke_dir/env"
export IMAGE_PREFIX=${SMOKE_IMAGE_PREFIX:-nexora-local}
export IMAGE_TAG=${SMOKE_IMAGE_TAG:-test}
export POSTGRES_PASSWORD
POSTGRES_PASSWORD=$(node -e "process.stdout.write(require('crypto').randomBytes(24).toString('hex'))")
export REDIS_PASSWORD
REDIS_PASSWORD=$(node -e "process.stdout.write(require('crypto').randomBytes(24).toString('hex'))")
node --input-type=module <<'JS'
import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const env = { NODE_ENV: 'production', DATABASE_URL: `postgresql://nexora:${process.env.POSTGRES_PASSWORD}@postgres:5432/nexora`, REDIS_URL: `redis://:${process.env.REDIS_PASSWORD}@redis:6379/0`, POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD, REDIS_PASSWORD: process.env.REDIS_PASSWORD, JWT_SECRET: randomBytes(32).toString('hex'), INTEGRATIONS_ENCRYPTION_KEY: randomBytes(32).toString('base64'), AI_KEY_ENCRYPTION_SECRET: randomBytes(32).toString('hex'), METRICS_TOKEN: randomBytes(32).toString('hex'), CORS_ORIGINS: 'https://app.example.com', DOMAIN: 'app.example.com', IMAGE_PREFIX: process.env.IMAGE_PREFIX, IMAGE_TAG: process.env.IMAGE_TAG, DOCUMENT_STORAGE_PATH: '/data/uploads', TRUST_PROXY_HOPS: '2', OCR_LANG_PATH: '' };
writeFileSync(process.env.APP_ENV_FILE, Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n') + '\n');
JS
compose=(docker compose -p "$smoke_project" --env-file "$APP_ENV_FILE" -f docker-compose.prod.yml)
cleanup() { "${compose[@]}" down -v >/dev/null 2>&1; rm -rf "$smoke_dir"; }
trap cleanup EXIT
"${compose[@]}" config --quiet
"${compose[@]}" up -d --wait postgres redis
"${compose[@]}" run --rm migrate
"${compose[@]}" up -d --wait --wait-timeout 180 api workflow-worker notification-worker document-worker frontend
"${compose[@]}" exec -T api node -e "Promise.all([fetch('http://localhost:3000/ready'),fetch('http://frontend:8080/api/v1/health'),fetch('http://frontend:8080/o/smoke/dashboard')]).then(rs=>{if(rs.some(r=>!r.ok)||!rs[2].headers.get('content-security-policy'))process.exit(1)}).catch(()=>process.exit(1))"
"${compose[@]}" exec -T api node --input-type=module < scripts/container-smoke.js
for service in api workflow-worker notification-worker document-worker frontend; do
  uid=$("${compose[@]}" exec -T "$service" id -u)
  test "$uid" != 0
done
"${compose[@]}" stop --timeout 30 api workflow-worker notification-worker document-worker
for service in api workflow-worker notification-worker document-worker; do
  container=$("${compose[@]}" ps -a -q "$service")
  code=$(docker inspect --format '{{.State.ExitCode}}' "$container")
  test "$code" = 0
done
echo 'Production Compose, migrations, business smoke, non-root services and graceful shutdown: OK'
