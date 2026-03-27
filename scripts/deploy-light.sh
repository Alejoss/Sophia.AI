#!/bin/bash

# Lightweight deployment for small/regular updates.
# Uses build cache and avoids full shutdown to reduce deploy time.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "⚡ Starting lightweight deployment..."
echo "This mode uses Docker build cache and skips full 'down'."
echo "For a clean rebuild, use: ./scripts/deploy.sh --no-cache"

"$SCRIPT_DIR/deploy.sh" --skip-down "$@"
