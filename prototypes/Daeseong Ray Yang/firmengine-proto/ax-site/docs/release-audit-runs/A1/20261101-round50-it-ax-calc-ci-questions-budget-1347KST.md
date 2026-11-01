# FirmEngine A1 50차 — 코드 완결성·상호 기능충돌 (IT / AX / 계산사무장)

- 날짜: 2026-11-01 KST. GitHub `firmengine/firmengine`의 **main**, 수정 범위는 정확히 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래로 제한. 운영 배포·D1 운영 마이그레이션·전자제출·법원 인가 확정 실행하지 않음.
- 역할 순환: 49차 **서류담당자/변호사/데이터담당자** → 50차 **IT담당자 A1-IT-016 / AX담당자 A1-AX-013 / 계산사무장 A1-CALC-011**. 세 ID 모두 **[ ] 부분검증**; 제품 완전 인수 0.
- 시작 및 코드 판독 main `e91e5288174392e5b3a7e0af4fc9759f3a595197`. 최근 커밋 및 열린 Draft PR #121, #124 확인. 49차 영수증·단일 보드·관련 schema, API, UI, 테스트, 기존 12차/24차 영수증 대조.
- 테스트의 모든 입력은 **가상·비식별 합성**. 공개 Git에 의뢰인 데이터·실제 원문/OCR·키/.env·비공개 정답 미기록. 실제 서비스 모델/데이터/고객 사건 사용 없음.

## A1-IT-016 — 최신 HEAD의 CI/TypeScript/lint/build·회귀 영수증 [ ]

- GitHub Actions `GET /repos/firmengine/firmengine/actions/runs?branch=main&per_page=5` 실제 조회: **total_count 0**, 확인 가능한 main 전체 CI 영수증 **0건**. 통과 0건과 실패 0건은 모두 **미관찰**로 기록한다.
- `package.json` blob `8129160e33af3ae250c757a6a8195a29674ad031`에서 Node >=22.13, `lint`, `build`, `check:product`, 부분 `test:*` 등록 확인. `scripts/run-preapproval-regressions.mjs` blob `c4bbeca539457d55b42d4029a416d6586cb06f86`: `--full`은 전체 `tests/*.test.ts`→ESLint→build 순차 실행 코드 존재. `scripts/verify-source-tree.mjs` blob `56fa722365f3d8ca7f1a9a0373cce6f6aa35de82`는 머지 마커 스캔 구현. `tsconfig.json` blob `f1c3de3fee3b976e8e4329809563892fc66b2d92`; `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`.
- 격리 실행 환경 Node 22.16 존재하나 `git ls-remote https://github.com/firmengine/firmengine.git`는 **DNS resolve failure**. 저장소 전체 다운로드·의존성 설치 불가능하여 **main 원본 Node 회귀, 전체 TypeScript, lint, build 미실행**. 외부 원문 함수 V8 추출 실행을 제품 CI라고 표시하지 않는다. 소스 코드와 러너 정의 존재는 제품 통과 아님.

## A1-AX-013 — 누락 증빙 → 사람 역질문 → 실제 서류요청 연결 [ ]

- 소스 `lib/approval-issue-graph.ts` blob `53df46fa1fcf34e19d8e9a192da1a8f87bf897cd`. 실제 `buildApprovalIssueGraph` 함수와 그 `uniq/missing/relatedCalculationIds` helper를 GitHub에서 읽고 **TS 표기만 제거해 V8 격리 실행**. 독립 기대는 원문 미관찰과 관측·미인정/0원/증거계약 미승인/오래된 법률 체크 상태를 서로 다르게 반환하는 것.
- **6/6 기대 일치**:
  1. 승인된 증거경로, Fact 없음+필수 계산 null → 질문 **2**, 증빙 미충족 **1**, 계산누락 **1**, 법률 상태 `not_currently_reviewed`.
  2. 관측 Fact 미인정+계산 `"0"` → 질문 **1**, 증빙 미인정 **1**, 계산누락 **0**.
  3. 유효 인정 Fact+계산 `"0"` → 질문 **0**, 계산값 존재하나 `value_present_requires_review` (법률 확정 아님).
  4. 미승인 evidence contract → 필수 질문 자동 승격 **0**, `unmapped_or_not_applicable`.
  5. 과거 법률 check `pass` 주입 + `legalCurrent=false` → `not_currently_reviewed`.
  6. 계산 필드 값 `undefined` → `missing`, null과 동일 금전 0으로 오인하지 않음.
- `app/api/cases/[id]/approval-readiness/route.ts` blob `731f66a10d4af704b432dcd298061b452941fd13`: 읽기 전용 GET에서 `caseRequirementMonitor`와 `buildApprovalIssueGraph` 호출. `components/consultation-checklist.tsx` blob `7748c02bf64c5162efe213939ce24cd20a74a923`: 상담 질문 UI·복사·재분석 경로. `lib/intake-engine.ts` blob `82ddba689ea6d107ba587235205feef45e058527`: 별도 상담 요구서류 로직. 기존 `tests/approval-issue-graph.test.ts` blob `0fffa4548046c8efd67639446526b8f0d8dd9d4d` **테스트 존재만 확인**.
- **결론:** 사람 질문 생성 **격리 실행됨**. 질문→기존 요구서류 DB 추가·관리자 발송·85종 대상/기간/갈음 반영의 **실 API·DB·UI 클릭 연결은 미관찰**. 새로운 자동 서류요청 완료 주장 금지. 이 회차 신규 코드 변경 없음.

## A1-CALC-011 — 월 변제예산 및 보수/우선/재단 비용 누락과 최종 문서 경계 [ ]

- 소스 `lib/assessment.ts` blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`의 실제 `trustee/priority/estate → disposable → ordinaryBudget` **산식 구문**을 추출해 V8 격리 실행. 금액 파서와 나머지 CaseData는 명시적인 **합성 stub**. 독립 산술 기대값:
  - income 1,000 / living 400 / trustee20 / priority100 / estate30 → 일반채권 예산 **450**, 일치.
  - 비용 세 항목 각각 실제 0 → **600**, 일치. 0과 미관찰 차별.
  - trustee 미관찰, priority null, estate null, trustee 음수 → 각 **null** + `PLAN_COST_OR_PRIORITY_PAYMENT_MISSING`, **4/4 일치**.
  - 소득 null 또는 생계비 null → 예산 **null**, **2/2 일치**. **산식 합계 8/8**.
- `lib/case-legal-calculation-preflight.ts` blob `c17892e63bf00d2981f292b0ef28e032d66a8dc7`: 실제 `evaluateLegalCalculationPreflight` 함수에서 TS 서명·`new Set` 제네릭만 제거해 V8 **8/8 기대 일치**: 현재 head 없음 대기, 법률상 필수 계산 예산 행 없음/null/blocked 차단, 허용된 0 값 존재, 원천 금액 불일치 차단, 소득 대표기간 미선택 차단. **`PLAN_COST_OR_PRIORITY_PAYMENT_MISSING`만 있고 승인된 법률 필수 계산 출력 집합이 비어 있으면 ready=true**는 실제 관찰된 현행 계약. 이는 최종 문서 승인이 아니라, 선택적 비용 누락만으로 95체크 사전 AI를 전면 차단하지 않는 **예비 법률 AI** 정책으로 별도 기록.
- `lib/assessment.ts` 후속 `assessCase`는 blocked trace → finding unknown → `canFinalize=false` 코드 경로가 있으며, `lib/document-writer.ts` blob `42dc797739784b6d4354bdf377c5afe6e8fc3e5a`의 `mode=final`은 `canFinalize`와 `processingComplete` 가드. `lib/automatic-review-draft.ts` blob `5ee8860250303ac9ca513b0be22e886f98c8e904`는 `mode=draft` 전용. **이 부분은 정적 코드경로 대조이며 실제 최종 DOCX 생성/거절 호출을 실행한 증거가 아니다.**
- 18계산/95법률, D5103/D5110, 실제 월별 변제예정액, 공식 법원 기준, 승인 워크플로·D1/R2 DB 재독 **미검증**. 신규 법률/회계 의미 변경 없음, 코드 패치/PR 없음.

## 상태와 다음

- 체크 ID: **A1-IT-016 / A1-AX-013 / A1-CALC-011 전부 [ ]**. V8 격리 **6 + 8 + 8 = 22조건 기대 일치**, 하지만 서로 다른 실행수준을 단일 인수성공률로 해석 금지. 신규 독립 결함 확정 0, 신규 코드 수정/PR 0.
- 사전 작성 Node 테스트 파일은 존재하나 이번 회차 **원본 Node 실행 없음**. 전체 CI/TS/lint/build/staging D1·R2·Cron/브라우저/공식 법원 서식/변호사 승인/사이트 배포 **미실행**. 법적 인정/확정값 승격 금지.
- **다음 역할:** 서류담당자 / 변호사 / 데이터담당자. **다음 ID:** `A1-DOC-002` 상담→서류목록 실제 UI/API/DB, `A1-LAW-003` 미확정 관할의 서울기준 잘못 적용, `A1-DATA-002` 85종 문서·48 OCR 패밀리 ID 고유성·설계/원문 매핑.
- 운영 배포, 운영 DB 마이그레이션, 실제 법원 제출·인가 확정 없음. 실제 실행 모델/추론 수준이 Extra High였는지 확인 불가.
