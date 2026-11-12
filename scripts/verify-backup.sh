#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Only the dedicated test Compose project is addressed here.
export COMPOSE_PROJECT_NAME=nexora-test
backup_test_dir=$(mktemp -d)
export APP_ENV_FILE="$backup_test_dir/env"
export BACKUP_DIR="$backup_test_dir/backups"
cat > "$APP_ENV_FILE" <<'ENV'
POSTGRES_PASSWORD=nexora_test
REDIS_PASSWORD=test-only
IMAGE_PREFIX=nexora-local
IMAGE_TAG=test
DOMAIN=localhost
ENV
cleanup() {
  docker compose -p nexora-test -f docker-compose.test.yml exec -T postgres dropdb -U nexora_test --if-exists nexora_restore >/dev/null
  docker compose -p nexora-test -f docker-compose.test.yml exec -T postgres psql -U nexora_test -d nexora_test -c 'DROP TABLE IF EXISTS qa_backup_probe' >/dev/null
  rm -rf "$backup_test_dir"
}
trap cleanup EXIT
docker compose -p nexora-test -f docker-compose.test.yml exec -T postgres psql -U nexora_test -d nexora_test -v ON_ERROR_STOP=1 -c "CREATE TABLE qa_backup_probe (value text); INSERT INTO qa_backup_probe VALUES ('restored-fixture');" >/dev/null
archive=$(bash scripts/backup.sh)
bash scripts/restore.sh "$archive" nexora_restore
count=$(docker compose -p nexora-test -f docker-compose.test.yml exec -T postgres psql -U nexora_test -d nexora_restore -tAc 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL')
test "$count" = 10
probe=$(docker compose -p nexora-test -f docker-compose.test.yml exec -T postgres psql -U nexora_test -d nexora_restore -tAc 'SELECT value FROM qa_backup_probe')
test "$probe" = restored-fixture
echo 'Backup restored successfully: all 10 migrations present.'
