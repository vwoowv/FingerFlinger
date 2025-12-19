@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM Run from FingerFlingerClient folder. This script installs dependencies and builds webpack bundle.

set "ROOT=%~dp0"

if not exist "%ROOT%package.json" (
  echo [ERROR] Cannot find "%ROOT%package.json"
  echo         Please run this script from the FingerFlingerClient folder.
  exit /b 1
)

cd /d "%ROOT%" || exit /b 1

echo.
echo [INFO] Node version:
node -v
echo [INFO] npm version:
npm -v
echo.

echo [INFO] Installing dependencies via "npm ci"...
npm ci
if errorlevel 1 (
  echo [WARN] "npm ci" failed. Falling back to "npm install --include=dev"...
  npm install --include=dev
  if errorlevel 1 (
    echo [ERROR] Dependency installation failed.
    exit /b 1
  )
)

echo.
echo [INFO] Building bundle via "npm run build"...
npm run build
if errorlevel 1 (
  echo [ERROR] Build failed.
  exit /b 1
)

echo.
echo [OK] Done. Output: assets\bundles\bundle.js
exit /b 0


