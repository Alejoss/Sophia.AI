#!/bin/bash
# Keep a copy of PostgreSQL stderr on the postgres_logs volume.
# The server itself still logs to stderr, so `docker compose logs postgres`
# shows the running container. Docker deletes that stream on recreate; the
# file copy remains.
set -euo pipefail

LOG_DIR="${POSTGRES_LOG_DIR:-/var/log/postgresql}"
LOG_FILE="${LOG_DIR}/postgresql.log"
MAX_BYTES="${POSTGRES_LOG_MAX_BYTES:-10485760}"
BACKUPS="${POSTGRES_LOG_BACKUPS:-14}"
ENTRYPOINT="${POSTGRES_DOCKER_ENTRYPOINT:-/usr/local/bin/docker-entrypoint.sh}"

mkdir -p "$LOG_DIR"
touch "$LOG_FILE"

rotate_if_big() {
  [ -f "$LOG_FILE" ] || return 0
  local size
  size=$(wc -c < "$LOG_FILE" | tr -d '[:space:]')
  [ "${size:-0}" -gt "$MAX_BYTES" ] || return 0
  local n="$BACKUPS"
  while [ "$n" -gt 1 ]; do
    local prev=$((n - 1))
    if [ -f "${LOG_FILE}.${prev}" ]; then
      mv "${LOG_FILE}.${prev}" "${LOG_FILE}.${n}"
    fi
    n="$prev"
  done
  mv "$LOG_FILE" "${LOG_FILE}.1"
  touch "$LOG_FILE"
}

rotate_if_big

echo "PostgreSQL persisted logs: ${LOG_FILE}"
exec "$ENTRYPOINT" "$@" > >(tee -a "$LOG_FILE") 2>&1
