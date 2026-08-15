#!/usr/bin/env bash
# Generates public/og-image.png (1200x630) using headless Google Chrome.
set -euo pipefail

CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [ ! -f "${CHROME_BIN}" ]; then
  echo "Google Chrome binary not found at ${CHROME_BIN}" >&2
  exit 1
fi

"${CHROME_BIN}" \
  --headless \
  --disable-gpu \
  --window-size=1200,630 \
  --hide-scrollbars \
  --force-device-scale-factor=1 \
  --screenshot="${REPO_ROOT}/public/og-image.png" \
  "file://${SCRIPT_DIR}/og-image-template.html"

echo "Generated public/og-image.png successfully."
