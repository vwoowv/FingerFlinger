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
call npm -v

REM Cocos Creator generates TypeScript declarations under temp\declarations.
REM Webpack build relies on them via tsconfig.webpack.json.
if not exist "%ROOT%temp\declarations\" (
  echo.
  echo [ERROR] Cocos TypeScript 선언 파일을 찾지 못했습니다: "%ROOT%temp\declarations\"
  echo         Cocos Creator로 이 프로젝트를 1회 열어 temp\declarations 를 생성한 뒤,
  echo         이 배치 파일을 다시 실행해 주세요.
  exit /b 1
)

echo [INFO] Installing dependencies via "npm ci"...
call npm ci
if errorlevel 1 (
  echo [WARN] "npm ci" failed. Falling back to "npm install --include=dev"...
  call npm install --include=dev
  if errorlevel 1 (
    echo [ERROR] Dependency installation failed.
    exit /b 1
  )
)

echo.
echo [INFO] Building bundle via "npm run build"...
call npm run build
if errorlevel 1 (
  echo [ERROR] Build failed.
  exit /b 1
)

echo.
echo [OK] Done. Output: assets\bundles\bundle.js
exit /b 0


