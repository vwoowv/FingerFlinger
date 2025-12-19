# 채팅 컨텍스트(다른 PC에서 이어가기용)

이 파일은 다른 PC에서 Cursor 채팅 히스토리가 안 보일 때, **새 채팅을 열고 그대로 붙여넣어 맥락을 이어가기** 위한 요약입니다.

## 현재 프로젝트/환경

- 프로젝트: `FingerFlingerClient` (Cocos Creator 3.8.8)
- 목표: npm 구성 안정화 + webpack으로 **Cocos 런타임에서 쓸 번들(bundle.js)** 생성

## 결정사항

- 씬/게임 로직은 당장 신경 쓰지 않음
- webpack 번들은 **B안(= Cocos 런타임 호환 번들)** 로 진행
- `bundle.js`는 **버전관리하지 않음** → `.gitignore`로 제외

## 해결/적용된 변경점 요약

### 1) npm 의존성 정리

- 처음 `npm ls`에서 `UNMET DEPENDENCY`가 뜬 것은 단순 미설치 상태였고 `npm ci`로 해결됨
- `ts-loader`의 peer dependency인 `typescript`를 **`package.json` devDependencies에 명시 추가**해서 팀/CI에서도 안정화

### 2) webpack 번들(Cocos 런타임용, SystemJS)

`npm run build` 결과가 “throw만 하는 깨진 번들”이 되지 않도록 아래처럼 정리:

- `tsconfig.webpack.json`에 Cocos 타입 선언(`temp/declarations/*.d.ts`)과 `experimentalDecorators` 적용
- `webpack.config.js`에서 출력 포맷을 **SystemJS(System.register)** 로 변경
- `cc`는 **external**로 남겨서(번들에 포함하지 않음) Cocos 런타임이 제공하는 엔진 모듈을 사용하도록 구성

### 3) gitignore 정리

레포 루트 `.gitignore`에 아래를 추가:

- `**/assets/bundles/bundle.js`
- `**/assets/bundles/bundle.js.map`
- 로그/OS 잡파일(`*.log`, `npm-debug.log*`, `Thumbs.db` 등)

### 4) 다른 PC용 실행 스크립트

`FingerFlingerClient/` 내부에 생성:

- Windows: `setup-build-win.bat`
- macOS: `setup-build-mac.sh`

동작:

- `npm ci` (실패 시 `npm install --include=dev`)
- `npm run build`

Windows PowerShell에서는 배치 실행 시 `.\`가 필요:

```powershell
.\setup-build-win.bat
```

## 빠른 명령 요약

`FingerFlingerClient/`에서:

```bash
npm ci
npm run build
```

## 참고 문서

- 상세 설치/빌드 문서: `docs/setup.md`

## 새 채팅에 붙여넣을 “요청 템플릿”

아래를 새 채팅 첫 메시지로 넣고 시작하면 맥락이 거의 그대로 이어집니다.

---

프로젝트는 Cocos Creator 3.8.8의 `FingerFlingerClient`이고, npm/webpack 번들(B안: Cocos 런타임용 System.register + cc external) 구성을 맞췄습니다.
변경 파일은 `package.json`(typescript 추가), `tsconfig.webpack.json`, `webpack.config.js`, 레포 루트 `.gitignore`, `setup-build-win.bat`, `setup-build-mac.sh`, `docs/setup.md` 입니다.
현재 `npm run build`는 성공하며 `assets/bundles/bundle.js`가 생성됩니다(단, 번들은 gitignore로 제외).

이 상태에서 다음으로 하고 싶은 건: [여기에 다음 작업/질문]

---


