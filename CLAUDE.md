# CLAUDE.md - AI 에이전트 필수 규칙

> 이 파일은 모든 작업 전에 자동으로 읽힌다.
> 여기에 적힌 규칙은 선택이 아니라 **필수**다.

---

## 절대 규칙: 코드 작업 전 반드시 수행할 것

**기능 개발, 버그 수정, 리팩터링 등 앱 코드를 변경하는 모든 작업에 적용된다.**
현재 저장소의 기본 작업 대상은 `poc/`이며, 추후 `src/` 구조가 도입되더라도 동일한 규칙을 적용한다.
- 이 워크플로는 Git 저장소를 전제로 한다. 아직 Git이 초기화되지 않았다면 먼저 저장소 초기화와 기본 브랜치 설정을 완료한다.

### 예외: 경량 POC 시각 수정

다음 조건을 모두 만족하는 작업은 토큰과 시간을 줄이기 위해 긴 EXEC_PLAN/worktree 절차를 생략할 수 있다.

- 범위: 로고 삽입, 버튼 문구/색상/간격 조정, 이미지 교체, 단순 레이아웃 미세 조정
- 허용 파일: `poc/index.html`, `poc/css/**`, `poc/assets/**`
- 금지 범위: `poc/js/**`, `scripts/**`, `package*.json`, 데이터 구조, API, 라우팅, 상태 관리, 인증, 테스트 러너 변경

경량 POC 시각 수정 절차:
- 사용자의 요청과 변경 파일을 한두 문장으로 확인한다.
- 필요한 파일만 읽고 수정한다.
- 새 테스트 작성은 생략할 수 있다.
- 커밋 전 빠른 가드(`check-file-sizes`, `check-docs`)를 통과해야 한다.
- 동작 로직이 바뀌거나 JS 수정이 필요해지는 순간 일반 절차로 전환한다.

### 예외: Claude/Codex 병행 최신화

사용자가 Claude와 Codex를 병행해 쓰는 경우, 한쪽 worktree에서 끝난 작업을 메인 `poc/`와 3001 테스트 서버에 반영하는 최신화 루트를 사용할 수 있다.

- 기본 확인: `npm run sync:poc`
- 특정 worktree 확인: `npm run sync:poc -- --source worktrees/<task-id>`
- 적용 및 3001 서버 재시작: `npm run sync:poc -- --source worktrees/<task-id> --apply --restart`
- 포트 3001은 고정 테스트 포트로 사용한다.
- 이 루트는 worktree의 `poc/` 최신본을 메인 `poc/`로 복사한 뒤 테스트와 JS 문법 검사를 실행한다.
- 서로 다른 worktree의 변경을 섞어야 하는 경우에는 자동 적용하지 말고 diff를 먼저 보고 사용자의 우선순위를 확인한다.

### 0단계: 진입 문서 확인
- 이 파일은 시작 규칙만 담는 진입 문서다.
- 세부 구현 규칙은 `AGENTS.md`, `ARCHITECTURE.md`, `docs/`에 기록한다.
- 관련 문서가 없으면 코드를 먼저 바꾸지 말고 필요한 문서를 생성하거나 갱신한다.

### 1단계: EXEC_PLAN 생성
- `bash scripts/start-task.sh <task-name> <type>` 실행.
- 이 스크립트는 `EXEC_PLAN`, `worktree`, 로그 디렉터리를 한 번에 생성해야 한다.
- 생성된 `EXEC_PLAN`에 목표, 접근법, 단계별 계획, 완료 기준, 검증 방법을 채운다.
- 작은 수정이라도 작업 의도와 검증 기준을 남긴다.
- **계획 없이 코드를 작성하지 않는다.**

### 2단계: worktree에서 구현
- 생성된 worktree 디렉터리로 이동하여 작업한다.
- `AGENTS.md` -> `docs/ARCHITECTURE.md` -> 관련 문서 순서로 읽는다.
- 구현 중 새로 알게 된 제약이나 결정 사항은 리포지터리 문서에 반영한다.
- **master/main 브랜치에서 앱 코드를 직접 수정하지 않는다.**

### 3단계: 테스트 작성 (필수 - 건너뛸 수 없음)
- 구현한 기능에 대한 **단위 테스트를 반드시 작성**한다.
- 테스트 파일 기본 예시: `src/**/*.test.jsx` (Vitest + React Testing Library)
- 현재 저장소처럼 `src/`가 없으면 실제 앱 코드 위치에 맞춰 동등한 테스트 경로를 사용한다.
- 테스트 기준:
- 새 기능: 정상 동작 + 엣지 케이스 + props/입력 검증
- 버그 수정: 재현 테스트 작성 후 수정하여 통과
- 리팩터링: 기존 동작 보존 확인
- `npm test` 또는 동등한 테스트 명령이 통과하지 않으면 pre-commit 혹은 커밋을 차단한다.

### 4단계: 검증 실행 (필수 - 건너뛸 수 없음)
- 커밋 전 `bash scripts/verify-task.sh`를 실행하여 전체 검증을 수행한다.
- 기본 검증 항목:
- 단위 테스트
- 린트
- 빌드
- 파일 크기 제한
- 아키텍처 의존성 규칙
- 문서 가드닝 또는 문서 신선도 점검
- 프로젝트에 아직 검증 스크립트가 없다면, 작업 범위에 맞는 최소 검증 스크립트를 먼저 만든다.
- **검증을 통과하지 않으면 커밋하지 않는다.**

### 5단계: 커밋 -> 머지 -> 완료 처리
- 커밋 메시지는 Conventional Commits 형식인 `feat(scope): 설명`을 따른다.
- master/main 머지 후 `bash scripts/complete-task.sh <task-id>` 실행.
- 완료된 `EXEC_PLAN`은 `docs/exec-plans/completed/` 또는 동등한 완료 보관 위치로 이동한다.

## 자동 차단 장치

| 규칙 | 도구 | 동작 |
|------|------|------|
| Conventional Commits 형식 | `commit-msg` 훅 | 커밋 차단 |
| 아키텍처 규칙 | `pre-commit` + staged guard | 커밋 차단 |
| 파일 크기 제한 | `pre-commit` + staged guard | 커밋 차단 |
| 문서 가드닝 | `pre-commit` + staged guard | 커밋 차단 |
| protected branch 직접 수정 | `pre-commit` | 커밋 차단 |
| 활성 EXEC_PLAN 없음 | `pre-commit` | 커밋 차단 |
| 계획에 없는 staged 파일 | `pre-commit` | 커밋 차단 |
| 단위 테스트 없는 코드 변경 | `pre-commit` | 커밋 차단 |
| `verify-task` 실패 | `pre-commit` | 커밋 차단 |

경량 POC 시각 수정은 위 표의 EXEC_PLAN/worktree/테스트/전체 verify 차단 대신 허용 파일 패턴과 빠른 가드만 적용한다.

## 빠른 시작 명령어

```bash
# 새 기능
bash scripts/start-task.sh add-feature-name feat

# 버그 수정
bash scripts/start-task.sh fix-bug-name fix

# 리팩터링
bash scripts/start-task.sh cleanup-scope refactor

# 훅 설치
bash scripts/install-hooks.sh

# 전체 검증
bash scripts/verify-task.sh

# Claude/Codex 병행 최신화 확인
npm run sync:poc

# 특정 worktree를 메인 poc에 반영하고 3001 서버 재시작
npm run sync:poc -- --source worktrees/<task-id> --apply --restart
```

```powershell
# PowerShell 환경
.\scripts\start-task.ps1 add-feature-name feat
.\scripts\verify-task.ps1
```

## 테스트 명령어

```bash
# 단위 테스트 실행
npm test

# 감시 모드
npm run test:watch

# E2E 테스트 (Playwright 또는 동등한 브라우저 스모크)
npm run test:e2e

# 전체 검증
bash scripts/verify-task.sh
```

## 하네스 엔지니어링 원칙
- 사람은 목표, 제약, 우선순위, 완료 기준을 제공하고 에이전트는 실행한다.
- 이 파일을 거대한 매뉴얼로 키우지 않는다.
- 이 파일은 짧은 진입점이며, 상세한 사실과 규칙은 버전 관리되는 문서에 분산 기록한다.
- 구두 지시, 메신저 대화, 개인 기억에만 있는 정보는 존재하지 않는 것으로 간주한다.
- 반복되는 리뷰 피드백은 문서 또는 린트/테스트 규칙으로 승격한다.
- 구현 방식보다 불변 조건과 기계적으로 검증 가능한 기준을 우선한다.
- 에이전트는 코드, 테스트, 로그, 스크린샷, 문서, 실행 결과를 사용해 스스로 검증하고 수정 루프를 반복해야 한다.

## 금지 사항
- 계획 없이 바로 코드 수정
- worktree 없이 master/main 직접 수정
- 테스트 없이 기능 추가, 버그 수정, 리팩터링 수행
- **테스트 없이 코드 커밋**
- **verify-task.sh 실행 없이 머지 요청**
- 문서 없이 아키텍처 결정
- 문서화가 필요한 구조 변경을 코드만 바꾸고 끝내기
