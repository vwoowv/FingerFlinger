#!/usr/bin/env bash
set -euo pipefail

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

# Cocos Creator generates TypeScript declarations under temp/declarations.
# Webpack build relies on them via tsconfig.webpack.json.
if [[ ! -d "${SCRIPT_DIR}/temp/declarations" ]]; then
  echo
  echo "[ERROR] Cocos TypeScript 선언 파일을 찾지 못했습니다: \"${SCRIPT_DIR}/temp/declarations\""
  echo "        Cocos Creator로 이 프로젝트를 1회 열어 temp/declarations 를 생성한 뒤,"
  echo "        이 스크립트를 다시 실행해 주세요."
  exit 1
fi

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


