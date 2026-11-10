#!/bin/sh
# Rotate oversized persisted nginx logs before nginx opens them, then start
# the official image entrypoint. Rename-based rotation is safe here because
# nginx is not running yet. Day-to-day rotation while nginx is up is handled
# by scripts/docker/acbc-logrotate.conf (USR1 reopen).
set -eu

LOG_DIR="${NGINX_PERSISTED_LOG_DIR:-/var/log/nginx/persisted}"
MAX_BYTES="${NGINX_LOG_MAX_BYTES:-10485760}"
BACKUPS="${NGINX_LOG_BACKUPS:-14}"
ENTRYPOINT="${NGINX_DOCKER_ENTRYPOINT:-/docker-entrypoint.sh}"

mkdir -p "$LOG_DIR"

rotate_file() {
  file="$1"
  [ -f "$file" ] || return 0
  size=$(wc -c < "$file" | tr -d '[:space:]')
  [ "$size" -gt "$MAX_BYTES" ] || return 0
  n="$BACKUPS"
  while [ "$n" -gt 1 ]; do
    prev=$((n - 1))
    if [ -f "${file}.${prev}" ]; then
      mv "${file}.${prev}" "${file}.${n}"
    fi
    n="$prev"
  done
  mv "$file" "${file}.1"
}

rotate_file "$LOG_DIR/access.log"
rotate_file "$LOG_DIR/error.log"

# Compose drops the image CMD when entrypoint is overridden. With no args,
# /docker-entrypoint.sh execs nothing and the container exits 0 ("Restarting").
if [ "$#" -eq 0 ]; then
  set -- nginx -g "daemon off;"
fi

echo "Nginx persisted logs: $LOG_DIR"
exec "$ENTRYPOINT" "$@"
