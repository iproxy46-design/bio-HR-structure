#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"
backup_root="${BACKUP_DIR:-$project_dir/../bio-backups}"
backup_dir="$backup_root/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p -- "$backup_dir"
docker compose exec -T postgres pg_dump -U bioapp -d bio_org -Fc > "$backup_dir/postgres.dump.partial"
mv -- "$backup_dir/postgres.dump.partial" "$backup_dir/postgres.dump"
cp -- .dev.vars "$backup_dir/dev.vars"
if [[ -f .env ]]; then cp -- .env "$backup_dir/compose.env"; fi
printf 'PostgreSQL backup saved: %s\n' "$backup_dir"
