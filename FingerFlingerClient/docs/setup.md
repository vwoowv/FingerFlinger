# FingerFlingerClient 설정/빌드 요약 (npm + webpack bundle)

이 문서는 다른 PC에서 프로젝트를 내려받았을 때, **npm 설치/webpack 번들 생성까지** 빠르게 재현할 수 있도록 현재 구성 상태를 정리한 문서입니다.

## (중요) Git LFS 필수

이 레포는 `.gitattributes`에서 `*.png`, `*.glb` 등 바이너리 에셋을 **Git LFS로 관리**합니다.  
따라서 **`git-lfs`가 설치되어 있지 않으면** 푸시/체크아웃/머지 훅에서 실패할 수 있습니다(소스트리는 LFS를 자동으로 포함하는 경우가 많음).

설치 후 아래를 1회 실행하세요:

```bash
git lfs install
```

### macOS (Homebrew)

```bash
brew install git-lfs
git lfs install
```

### Windows

아래 중 하나로 설치 후:

- `winget install GitHub.GitLFS`
- 또는 `choco install git-lfs`

그 다음:

```powershell
git lfs install
```

## 프로젝트 위치/전제

- 이 문서는 `FingerFlingerClient/` 폴더 기준입니다.
- webpack 번들 산출물은 `assets/bundles/bundle.js` 로 생성됩니다.

## 빠른 실행(권장)

### Windows

`FingerFlingerClient` 폴더에서:

```powershell
.\setup-build-win.bat
```

> PowerShell에서는 배치 파일을 실행할 때 `.\` 접두어가 필요합니다.

### macOS

`FingerFlingerClient` 폴더에서:

```bash
chmod +x ./setup-build-mac.sh
./setup-build-mac.sh
```

## 수동 실행(스크립트 없이)

`FingerFlingerClient` 폴더에서:

```bash
npm ci
npm run build
```

`npm ci`가 실패하면(락파일/환경 차이 등):

```bash
npm install --include=dev
npm run build
```

## npm 구성(의존성)

webpack 번들링을 위해 아래 devDependencies가 필요합니다.

- `webpack`
- `webpack-cli`
- `ts-loader`
- `typescript` (**ts-loader peer dependency이므로 명시**)

## webpack 번들 구성(= Cocos 런타임에서 사용, B안)

현재 webpack 설정은 **Cocos 런타임 호환을 목표로** 아래 특징을 가집니다.

- **출력 포맷**: `System.register` (SystemJS)
- **엔진 모듈 처리**: `cc`는 **external**로 남겨서(Cocos 런타임에서 제공) 번들에 포함하지 않음
- **Cocos 타입/데코레이터 지원**: `temp/declarations/*.d.ts`를 webpack용 tsconfig에서 참조하고 `experimentalDecorators` 활성화

관련 파일:

- `webpack.config.js`
- `tsconfig.webpack.json`

## 산출물 / 버전관리(git)

- 번들 산출물:
  - `assets/bundles/bundle.js`
  - `assets/bundles/bundle.js.map`
- 위 파일들은 생성물이라 `.gitignore`로 제외하는 구성을 사용 중입니다.

## 참고(경고 메시지)

`npm run build` 시 아래 경고가 보일 수 있으나, **빌드 실패 원인은 아닙니다**.

- `baseline-browser-mapping` 데이터 오래됨 경고


