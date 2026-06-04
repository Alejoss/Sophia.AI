#!/bin/bash
# Pull prebuilt GHCR images and redeploy (no local build). Run on the server from repo root.
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$SCRIPT_DIR/deploy.sh" "$@"
