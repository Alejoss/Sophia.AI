#!/bin/bash

# Lightweight deployment for small/regular updates.
# Pulls prebuilt GHCR images and avoids full shutdown to reduce deploy time.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "⚡ Starting lightweight deployment..."
echo "This mode pulls prebuilt GHCR images and skips full 'down'."
echo "For an intentional local rebuild, use: ./scripts/deploy.sh --build-local"

"$SCRIPT_DIR/deploy.sh" "$@"
