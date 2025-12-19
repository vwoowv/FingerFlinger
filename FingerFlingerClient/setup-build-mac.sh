#!/usr/bin/env bash
set -u

# Run from FingerFlingerClient folder. This script installs dependencies and builds webpack bundle.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -f "${SCRIPT_DIR}/package.json" ]]; then
  echo "[ERROR] Cannot find \"${SCRIPT_DIR}/package.json\""
  echo "        Please run this script from the FingerFlingerClient folder."
  exit 1
fi

cd "${SCRIPT_DIR}"

echo
echo "[INFO] Node version:"
node -v
echo "[INFO] npm version:"
npm -v
echo

echo "[INFO] Installing dependencies via \"npm ci\"..."
if ! npm ci; then
  echo "[WARN] \"npm ci\" failed. Falling back to \"npm install --include=dev\"..."
  npm install --include=dev
fi

echo
echo "[INFO] Building bundle via \"npm run build\"..."
npm run build

echo
echo "[OK] Done. Output: assets/bundles/bundle.js"


