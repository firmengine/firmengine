# A4 2회차 — 같은 사건번호 복수 보정명령의 답변 오연결·기한 원문 검토

검증 시작 2026-10-30 14:44 KST / 검사 대상 main `8fef575a5fa5e0b5dd5e8c384b01b017c78bb57e` / 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만.

**역할 순환**: 이전 A4 1차 IT→데이터→AX에 이어 **사용자·서류담당자, 변호사, 계산사무장, 데이터담당자** 4관점. 체크 ID **A4-DOC-007 / A4-LAW-008 / A4-CALC-004 / A4-DATA-012**, 교차 **X-042 / X-044**의 일부. 이 체크 ID는 모두 **[ ] 부분검증** 유지한다. 운영 E2E/법률승인 없음.

## 기존 회차 및 병렬 PR 상태

- 선행 [A4 1차](20261030-round01-poll-race-and-draft-subject.md)의 원본 V1↔V2 poll lease 문제 [PR #16](https://github.com/firmengine/firmengine/pull/16) 및 채권자 반복행 혼합 [PR #15](https://github.com/firmengine/firmengine/pull/15)는 **이 감사 시작 시 미병합**. [A1 PR #17](https://github.com/firmengine/firmengine/pull/17)은 draft commit 시 old source를 완료로 쓰는 CAS 수정 **미병합**. 4축 감사의 결과를 섞거나 타 PR 변경을 덮지 않았다.
- 실제 읽은 원천: `lib/preapproval-correction-item-store.ts` (main blob `6d11dcfb700909a9fcae7e40fad0713ad8cb05e0`), `lib/preapproval-correction-audit.ts`, `lib/case-procedure-events.ts`, `drizzle/0022_preapproval_court_correction_items.sql`, `tests/preapproval-correction-item-store.test.ts`, `tests/preapproval-correction-audit.test.ts`, `lib/case-data-recompute.ts`, `lib/case-calculation-feature-store.ts`, `lib/case-legal-automation.ts`. **법률이행/접수 확정은 별개.**

## P0 — 법원 보정답변의 개별 order identity 없이 동일 법원 사건번호로 오연결

- `ProcedureEvent`는 `id/state/courtReference/sourceDocumentIds/relatedFields`를 갖지만 응답 event에 **개별 보정명령 ID로의 명시적 링크가 없음**. 두 보정명령 A/B가 같은 법원 사건번호를 공유하면 `validateCorrectionItemDraft`는 `received-answer`와 A의 `courtReference`가 같다는 것만으로 A에 답변·접수증 바인딩을 **허용**. `readCourtCorrectionItems`도 같은 조건이어서 과거 잘못된 매핑이 `sourceCurrent=true`, `draft` 존재로 표시된다. `courtOrderSatisfied` 자체는 기존에도 `false`이며, 실제 법원 승인/인가 오기록은 이 반례에서 발생하지 않았다.
- **원본 함수 본문을 직접 추출하여 실행**(V8 JS 격리; TypeScript 서명 제거·`currentFacts` 등 범위 외 의존성은 테스트 stub). 합성 order A/B: 동일 `courtReference='same-ref'`, 별도 원본 PDF, B의 답변 event/파일. **독립 기대: A에 B 답변 바인딩 거부**. **main 실제 결과: ACCEPT (결함)**; 다른 사건번호는 정상 거부, 단일 명령에서는 정상 수락.
- 대응: [**Draft PR #19**](https://github.com/firmengine/firmengine/pull/19), branch `audit/a4-court-response-order-ambiguity-20261030`, head `f44a8e17e954c501e011c0865e3082aa92a17382`. 동일 `courtReference`의 현재 `correction_requested`가 **정확히 하나일 때만** 답변 event와 자료를 자동 연결. 복수 명령이면 `CORRECTION_RESPONSE_ORDER_AMBIGUOUS`으로 사람/추후 명시적 order link 검토. 답변 연결 없는 별도 항목 등록은 유지. 기존 바인딩은 **삭제하지 않고 read 시 stale/draft 비표시**로 보호.
- **수정 함수 본문 격리실행 5/5 예상 동작**: 동일 사건번호 복수명령 거부, 단일명령 연결 수락, 다른 사건번호 거부, 답변 없는 항목 등록 수락, 두번째 명령이 다른 사건번호인 경우 수락.
- **실제 `readCourtCorrectionItems` 함수 본문 격리실행 4개 관찰**(구체적으로 변경 전후 × 명령 1/2개, D1 adapter·currentVersion/currentFacts만 테스트 stub):
  - main 단일 order: `sourceCurrent=true` / main 복수 order: **`sourceCurrent=true` (잘못됨)**.
  - PR 단일 order: `sourceCurrent=true` / PR 복수 order: **`sourceCurrent=false`, `draft=null` (기대 일치)**.
  - 모든 경우 `courtOrderSatisfied=false` 보존. 테스트는 실제 Node 전체 repo 테스트가 아니라 **원본 함수 본문 격리 호출**.
- 저장소 `tests/preapproval-correction-item-store.test.ts`에 **회귀 4건 추가**: 복수 명령 거부, 답변 없이 항목 등록, 다른 사건번호 허용, 후발 복수 명령으로 과거 답변 stale. PR은 **2파일만 변경**, 현재 main에 병합하지 않음.

## P1 — 보정명령 원문 인용(orderQuote)의 페이지 텍스트 일치 검증 공백

- `validateCorrectionItemDraft`는 `orderDocumentId/orderPage`와 인용문 길이를 확인하나 **`orderQuote`가 그 원문 페이지에 실제 존재하는지/대응하는 OCR span인지 확인하지 않음**. 합성 PDF 페이지 원문 텍스트와 전혀 다른 긴 임의 인용문을 넣었을 때 원본 함수가 **ACCEPT**, `appearsOnPage=false` 관찰(격리 함수 실행). 이 상태가 실제 법원 문서 위조나 법률 승인으로 직결된다는 뜻은 아니다.
- **해결 설계 필요**: 스캔 PDF는 OCR text가 공란이거나 오인식될 수 있으므로 무조건 문자열 일치 차단은 오탐 위험. 원본 페이지/좌표 인용 또는 별도 직원 원문 이미지 대조·직원 확인 이력, source span hash 및 독립 법률 검수 게이트가 필요. 이번 PR은 답변 오연결만 최소 변경했으며 인용검증 계약 변경은 별도 검토로 보류한다.

## 기존 보정기한·계산·이벤트 상태(독립 검증 수준)

| ID | 확인 내용 | 실행/판정 |
|---|---|---|
| A4-DOC-007 | `validateCorrectionItemDraft`가 보정기한을 법원 원문 `verified+accepted` Fact 및 `sourceFactId`와 연결, 기한 null은 임의 날짜 생성하지 않음. 실제 보정항목 read는 source fact 철회 시 stale 처리하도록 코드·테스트 존재 | **CODE_REVIEWED**; 기존 Node 테스트 현재 직접 실행하지 않음, 실제 법원 PDF·기한 알림 E2E 미인증 |
| A4-LAW-008 | `courtReference`는 법원 사건번호이지 개별 명령 ID가 아님. 동일번호 2개 명령 + 응답 1개를 잘못 연결할 수 있음 | **DEFECT_REPRODUCED / ISOLATED_FUNCTION_PASS / DRAFT_PR_PENDING** |
| A4-DATA-012 | 새 보정명령 event가 뒤늦게 추가될 때 기존 답변 current가 false가 되어야 함 | 실제 read 함수 본문 합성 **4/4 관찰**, 추후 실제 DB·event replay/복수 워커 미인증 |
| A4-CALC-004 | `caseDataQuietWindow` 실제 원본 함수를 추출해 10분 직전/정확히 10분/날짜 null/SQLite UTC/잘못된 날짜 **5/5 기대 일치**. `recomputeCaseDataUpdate`는 sourceVersion·caseRevision·quiet 재확인, `persistCaseCalculationFeatures` head는 source guard 확인 | **SYNTHETIC_PURE_FUNCTION_PASS**만. 과거 결과가 reference release 변경 뒤 잠시 head로 승격되는 경합 및 staging 2워커 운영 미검증. 선행 PR #16/#17 미병합 |
| X-042/X-044 | 실제 법원명령 PDF·항목·기한·답변·접수증의 혼합/철회/후발 이벤트 | **부분 검증**. 실제 법원 자료/서류/접수증 바이트 E2E 없음 |

## 실행과 인증 경계

- **이번 회차 실제 완료**: GitHub 최신 main·PR·소스·migration·기존 테스트를 확인, 원본 함수 `validateCorrectionItemDraft` 결함 격리 재현, 개선된 함수 5건 실행, 실제 `readCourtCorrectionItems` 본문 4개 조건 호출, 10분 quiet pure 함수 5개 실행, 원문 인용 공백 1건 재현. 코드+원본 Node 테스트 파일 2개 수정 후 Draft PR #19 제출. 다른 A1/A2/A3 PR을 변경하지 않음.
- **실행하지 못함**: 해당 PR branch의 `npm ci`, `node --experimental-strip-types --test tests/preapproval-correction-item-store.test.ts`, 전체 Node CI/lint/build, migration 실제 D1 적용, R2/Cron·두 워커 통합, OCR PDF/Word 실제 바이트, 변호사 검토/법원 접수·인가. connector HEAD에서는 GitHub commit checks **0개/CI 워크플로 실행 0개** 조회. 따라서 **[x] 완료 처리 0건**, 코드 수정은 **미병합**.
- **PR #19 합격 필요 조건**: Node 원본 4회귀 + 기존 13테스트 전수, 기준정보/절차 이벤트·서류 담당자 UI 검수, 실제 D1/R2 staging에서 answer event 재배정 차단, 변호사 별도 검토. 현재 구조에 개별 `responseToCourtOrderEventId`가 없으므로 동일 사건번호 복수 명령의 수기 답변 연결은 일단 보류된다.

## 다음 회차

1. **A4-IT-006 / A4-DATA-013 / X-047**: R2 성공→D1 실패/응답 소실·중복 retry. 가능한 실제 SQL 격리 + 이벤트 adapter 연쇄, 운영 staging 불가 시 미인증 명시.
2. **A4-DOC-007 / A4-LAW-008 추가**: 보정명령 원문 인용 source span의 원문 이미지/좌표 검증 또는 수기대조 승인 경계; 복수 법원명령의 개별 order identity 설계. 실무 법률 승인 필요.
3. **A4-CALC-004 / A4-DATA-012**: reference SHA 변경 중 계산 head promotion·늦게 도착한 응답/재시도 event 순서 독립 검증.
4. PR #15/#16/#17/#19 모두 main 미병합이므로 최신 소스와 충돌 검토·실제 Node CI/스테이징 인수 후 병합 여부 결정. 자동 병합·운영 배포 금지.
