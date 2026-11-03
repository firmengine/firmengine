# FirmEngine A1 116차 — 배포 판본·직원 오류 복구 UI·수동 법률 AI 사전차단 (2026-11-04 KST)

## 감사 범위와 증거 등급
- 범위: `firmengine/firmengine`의 `main` 내 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 115차 다음 3 ID **A1-IT-017 / A1-AX-017 / A1-CALC-017**을 점검하며 역할 IT → AX → 계산사무장 순환. 이후 DOC → LAW → DATA.
- 시작 조회 HEAD **164122acb54286eacddc69b86fdebe52b0b8714c**. 직전 커밋 A3 r116 보드 `164122ac`, A3 영수증 `52fae663`, A2 r116 보드 `bdcc64be`, A2 영수증 `a41fe482`를 조회. 115차 A1 영수증, 84·22·20차 A1 선행 결과 및 현재 보드, 실제 코드·기존 테스트·Draft PR #32/#41/#73 확인.
- 코드 원본 blob: `components/case-workflow.tsx` **2ec797958726b99a4358ec46ef35f78f90bfd927**; `app/api/cases/[id]/process/route.ts` **e153bdb44ec7614de4cd9a9adfaf76e5e7fc4b64**; `lib/case-legal-calculation-preflight.ts` **c17892e63bf00d2981f292b0ef28e032d66a8dc7**; `lib/case-legal-source-preflight.ts` **0a4bf038a97de015652d4957a56ecddd5c049bd8**; `lib/case-agent-scheduler.ts` **0bb91c69dbc06495873cff1e4d5911679baaa335**; `db/schema.ts` **933f8686845ac14669312dd21bf85e02c62ed5e6**; `package.json` **8129160e33af3ae250c757a6a8195a29674ad031**.
- 기존 테스트 소스 조회: `tests/case-legal-calculation-preflight.test.ts` **46c7243e5e7ed44a7349a042f229d77535a8f28d**, `tests/case-legal-source-preflight.test.ts` **756c3195586d0449a3b4a37294e847b878bab56e**, `tests/case-workflow-view.test.ts` **d8e2ce43f46c82b2389f523b9d9af3403ec5f761**. 이 테스트들은 **읽기만 했고 Node 테스트러너로 실행하지 않았다**.
- 실행 방법: GitHub connector에서 조회한 실제 TS 함수의 타입 주석만 격리 실행용 제거, Code Mode **V8 `new Function`**으로 합성 입력 실행. `POST` 경로의 원래 분기식은 유지하고 인증·DB·모델·응답 의존성은 synthetic stub으로 대체. UI는 실제 JSX에 나타난 **재시도 버튼 표시 조건식만** 격리 실행. v43 대비 파일 비교는 각 Git blob SHA 직접 대조.
- 등급: **선별 원본 함수/조건식 격리 검증·보관본 파일 SHA 비교**. 제품 Node/TypeScript/lint/build/전체 CI, 실제 HTTP 인증·브라우저, 현재 Sites 배포·staging D1/R2/Cron, 85서류·18계산·95법률 전체 흐름, 공식 Word·변호사 승인과는 별개이다. 모두 synthetic이고 운영·실사건 데이터 미사용.

## A1-IT-017 [ ] — 역사적 v43 대비 현재 main; 현 배포판은 미관찰
- 이전 보관 `docs/releases/ax-v43/deployment-receipt.json` blob **5cf3179d2ff429bbda8b879d8aa1f8bbbc31ff51**: captured 2026-10-29T03:13:08.337Z, 당시 version 43, source commit `72b23f2c3faee5656caeeb1e6e6afce9a65de3cb`, 당시 성공 배포 기록. `source-file-manifest.json` blob **dec7460fd44424ba462618af1a215fc12b5c5230**: 528파일.
- 현 main **14개 개별 path git blob**을 기록된 `source/<path>` 보관 blob과 직접 비교. **동일 3, 다름 6, v43 manifest 미존재 5**:
  - 동일 3: `lib/reference-release.json` (양측 **5537e47c**), `app/api/cases/[id]/documents/route.ts` (양측 **274f7a6e**), `app/api/cases/[id]/process/route.ts` (양측 **e153bdb4**).
  - 다름 6: `db/schema.ts` (**main 933f8686** / v43 **67fd5eac**), `package.json` (**8129160e** / **939c0b54**), `lib/pipeline.ts` (**79dce5f9** / **a3af316a**), `lib/luna.ts` (**e8ad1246** / **5100868b**), `lib/domain.ts` (**39ab4185** / **57f7a0da**), `lib/assessment.ts` (**ee0f12bd** / **c1f53580**).
  - v43 manifest 미존재 5: `app/api/cases/[id]/commands/route.ts` (**main 44c26795**), `lib/case-calculation-feature-store.ts` (**bb5f88b2**), `lib/case-legal-calculation-preflight.ts` (**c17892e6**), `components/case-workflow.tsx` (**2ec79795**), `lib/case-agent-scheduler.ts` (**0bb91c69**).
- **독립 기대:** 보관된 v43과 현재 main이 다르다면 과거 배포 완료를 현 HEAD 배포 완료로 대체하지 않는다. 실제 비교는 기대와 일치. 그러나 현재 운영 Sites가 v43인지, 재배포된 다른 SHA인지, DB 스키마/기준정보가 현재와 일치하는지는 **조회할 수 없었다**. Git main·현 배포 동일성 **인수 미완료**.

## A1-AX-017 [ ] — 오류 원인·영향·복구를 직원에게 보이는 경계
- 실제 UI JSX 조건식 `(data.legalAutomation.status==="failed"||projectionRepairable)&&typeof data.legalAutomation.currentDataVersion==="number"`를 추출해 V8에 적용한 **9조건/9조건 표시 동작 확인**:
  1) failed/null→버튼 없음; 2) failed/0→버튼 있음(0≠null); 3) failed/5→있음; 4) running/5→없음; 5) completed/5→없음; 6) completed/5 + projectionRepairable→있음; 7) failed/"5"→없음; 8) failed/undefined→없음; 9) failed/-1→있음(숫자 타입만 검사).
- 실제 컴포넌트는 `lastError`가 truthy일 때에만 `실행 오류` 상세를 표시하고, null일 때 사유 설명 없음. `failed+currentDataVersion=null+lastError=null` 합성에서 버튼 없음/원인 없음; 오류 영향 범위·사람 담당·회복 안내를 구조화해 노출하는 화면은 **이 컴포넌트에서 확인되지 않음**. 상태 라벨과 일반 `/tasks` 이동 안내는 있으나 결함 사유/복구 단계와 동일하지 않다.
- 표시 조건 9/9는 **컴포넌트 조건식 실행 관찰**이지 최종 UX/운영 복구 합격이 아니다. -1은 버튼이 보이지만 실제 retry API가 거부할 수 있고 해당 HTTP 경로는 미실행. 기존 [Draft PR #32](https://github.com/firmengine/firmengine/pull/32)가 동일 컴포넌트 변경, 제품 코드 중복 수정 없음. 직원 UX/상태별 복구 계약·브라우저 검증 남음.

## A1-CALC-017 [ ] — 필수 계산값/수동 법률 AI 진입 전제
- `evaluateLegalCalculationPreflight` **실제 함수 본문**을 격리 실행, 필수 `monthlyIncomeWon` 합성 20조건: **12/20 독립 기대 일치, 8개 오류 통과**. 유효 원단위 정수 0/1200/-5, null, undefined, 빈 문자열, unknown, 미승인 상태, 구판본 HEAD, 확정 원천금액 충돌, 선택적 잠정액은 기대에 부합. 반면 **소수 1.5, NaN, Infinity, safe integer 범위 초과, boolean true, array [12], object {value:12}, numeric string "1200"** 모두 필수 `computed` 값으로 허용(**독립 기대: 차단**). 값 타입 검사가 null/빈 값 판별에만 머문 기존 P1이며 [Draft PR #41](https://github.com/firmengine/firmengine/pull/41) 미병합.
- `POST /api/cases/{id}/process` 실제 POST 본문을 타입 구문만 제거해 격리 실행. `action=legal` 경로의 synthetic `reviewLegal` stub 진입을 관측. 원천 미준비/계산 준비/양쪽 준비/양쪽 미준비 **4조건에서 무조건 `reviewLegal` 1회, HTTP 결과 stub 200**: 준비 둘 다 완료 1건만 독립 기대와 일치(**1/4**). 이 경로에는 `inspectLegalAutomationSourceReadiness`/`inspectLegalAutomationCalculationReadiness` 사전 호출이 없다. 반면 `case-agent-scheduler.ts` Cron 경로에는 두 검사 순차 호출이 있다. 기존 [Draft PR #73](https://github.com/firmengine/firmengine/pull/73) 미병합.
- **주의:** 위 `reviewLegal`은 실제 모델이 아닌 stub. 수동 경로에서 유료 AI 호출·법률 확정이 실제 수행됐다고 주장하지 않는다. downstream `reviewLegal` 내부에 독립 차단이 있는지, 수동 예비자문 정책이 어떻게 정의돼야 하는지 변호사·계산사무장 검토가 필요. 계산/법률 승인 의미를 바꾸므로 임의 main 패치 금지.
- `not_applicable`, `provisional`, `null`, `0`, `source-only`, 오류·검토전 상태를 합치지 않았으며 미관찰 금액을 합성 0으로 채우지 않음.

## Git 조치·다음
- 신규 제품 소스/테스트 코드 수정 **0**; 기존 Draft #32/#41/#73이 열려 있고 UI·계산법률 기준 변경과 충돌하므로 미검증 병합 금지. **신규 회차 영수증 1개와 보드의 해당 3 ID만** 남긴다.
- 실제 테스트: v43↔main Git blob 14 path 비교, UI 조건식 9 입력, 순수 계산 preflight 20 입력, POST 법률 라우트 4 입력. **14개 파일 대조와 V8 33조건은 서로 다른 증거등급이므로 통합 정확도 비율로 표현하지 않는다.**
- 각 ID는 **[ ]**. 실제 고객/원본 OCR/개인정보/키/.env/비공개 정답 없음. 운영 배포·D1 운영 마이그레이션·전자제출·법원 인가 확정 수행하지 않음. 제품 종단 인수 **0건**.
- 다음 역할 **사용자·서류담당자 → 변호사 → 데이터담당자**. 보드 다음 후보 **A1-DOC-018** (네트워크 단절/새로고침 뒤 명령 중복·유실), **A1-LAW-003** (미확정 관할의 서울 기본값·Draft #128), **A1-DATA-017** (페이지 재분류 뒤 typed/법률 소비처 재투영). 다음 회차도 최신 HEAD/PR·Schema·영수증 갱신 필수.
