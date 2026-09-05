#!/usr/bin/env sh
set -eu

backup_dir="${BACKUP_DIR:-./backups}"
mkdir -p "$backup_dir"
timestamp="$(date +%Y-%m-%d_%H-%M-%S)"
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL não configurada" >&2
  exit 1
fi

pg_dump --dbname="$DATABASE_URL" --no-owner --no-privileges \
  | gzip > "$backup_dir/money-manager_$timestamp.sql.gz"
