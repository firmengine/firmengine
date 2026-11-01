# FirmEngine A1 52차 — 화면/API 경로·자동초안 승인 차단·36/48/60회차 일정

- 기준: 2026-11-01 15:54 KST, 시작·쓰기 전 GitHub `main` HEAD `135ddad15ab2a9dc366ef10740981797da678338`; 단일 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` blob `a79853ec600638f4216176339d9211b00b790568`. 최근 commit·열린 PR·51차 영수증·코드/테스트/스키마 확인 후 **51차 DOC/LAW/DATA → 52차 IT/AX/CALC** 역할 순환.
- 점검 ID: **A1-IT-001 / A1-AX-014 / A1-CALC-012**. 세 ID 모두 `[ ]` 부분 검증. 운영 D1/R2, 전자제출·배포·법원 승인, 실 의뢰인 자료 없음. 아래 검증 입력은 합성.
- 로컬 GitHub HTTPS clone은 DNS 해석 실패로 불가. GitHub 연결을 통해 원본 blob을 고정 SHA로 읽고 함수의 TypeScript 서명·import만 테스트용으로 제거한 **V8 격리 실행**. 이는 프로젝트 원본 Node 테스트/CI·브라우저/실 DB 실행과 다름.

## A1-IT-001 — UI·REST API 도달성 [ ] (IT담당자)

- 코드: `components/workspace.tsx` blob `37bc60405f3017bf42b12d8a26a7f0aace78d0cc`의 **실제 `routeFor` 판정식** V8 실행. 합성 `caseId=synthetic-case-52`에서 overview → `/cases/synthetic-case-52`, documents → `/cases/synthetic-case-52/documents`, ledger → `.../facts`, review → `.../review`, exports → `.../exports`, benchmark → `/evaluation`, settings → `/settings`: 독립 예상 URL 대비 **7/7 일치**.
- 실제 main `app/`의 대응 페이지 파일 **12/12 존재**: `/evaluation`, `/settings`, `/cases/[id]/documents`, `/cases/[id]/facts`, `/cases/[id]/review`, `/cases/[id]/exports`, `/cases/[id]/consultation`, `/cases/[id]/workflow`, `/reference-data`, `/data`, `/tasks`, `/roles` (위 path에 `/page.tsx`). `app/page.tsx` 및 `app/cases/[id]/page.tsx`의 Workspace 렌더 연결도 읽음.
- 대표 요청/API 파일 **8/8 존재·메서드 선언 정적 확인**: workspace GET `58c8d7ba`, cases POST `75beaa0f`, cases/[id] GET/POST/PATCH `a8eedd2f`, process GET/POST `e153bdb4`, export POST `4f9384e8`, documents/[doc] GET `db20b924`, consultations GET/POST `94d930ee`, workflow GET `5d4a0508`. 문서 단건 경로는 실제 폴더 이름 `[doc]`이며 `[documentId]`가 아님. 이는 Next 동적 세그먼트 이름 차이로 URL 구조 불일치 증거가 아님.
- **범위 한계:** 죽은 버튼 전체 탐색, 중복 라우트 전수검사, 클릭/권한/인증/HTTP/DB E2E는 미실행. 소스상 URL 생성 성공·파일 존재만 관찰. 이번 대상에서 신규 확정 결함 없음.

## A1-AX-014 — 법률·계산 미확정 시 자동초안 차단 [ ] (AX담당자)

- `lib/case-lawgraph-store.ts` blob `eea435bb78f804c79a213c464af54e8014a3c3a5` 실제 `automatedDraftEligibility` + `checkCoverage`·`expectedIds` 함수 본문 V8 실행. C01/C02/C04 합성 체크, 필수 계산 출력 13개를 **값 문자열 `"0"`(관측 0원)** 으로 채움. 검증 11개: 모두 유효/값0 허용, C04 누락, C02 missing, C02 legal_review 허용/불허, 필수 계산 null, 계산 conflict, 동일 출력 중복, calc head stale, engine gate 차단, explicitFailures. **독립 기대 11/11 일치**; 모든 결과 `courtApprovalInferred=false`, `canFinalize=false`. `legal_review` 허용은 **검토용 초안**만 뜻하며 최종 승인과 분리.
- `lib/case-legal-automation.ts` blob `4af7a76d0935d532a3f5c0ca5fef4656be7eaf92`의 `finalizeReview → draft_pending → processDraft` 경로와 별도 원천 projection 게이트를 정적으로 추적.
- **기존 미병합 P1 경계 지속:** `lib/automatic-review-draft.ts` main blob `5ee8860250303ac9ca513b0be22e886f98c8e904`는 완료 단계 SQL이 현재 사건 revision/source version, reference SHA, lease token·만료 시점에 모두 결속되지 않음. 기존 [Draft PR #17](https://github.com/firmengine/firmengine/pull/17) HEAD `0ce1292a241d8baf98d5b9e230071cca980eb2fa`, helper blob `ebb2de08c1371ed3c37d9946f37b3ce251a8b628`의 **실제 함수** V8 실행으로, receipt INSERT에는 pending + live case/source/calc/legal/reference/lease predicates, 완료 UPDATE에도 live case/source/calc/legal/reference/lease predicates 확인. placeholder/parameter 길이 **receipt 19/19, finish 16/16** 일치.
- **범위 한계:** 이번 회차는 SQL 원문 조건 대조·SQL 생성 함수 V8 실행까지만. 실제 D1 batch/worker 경합·저장된 writer ACK/실 생성물 종단 시험 **미실행**. PR #17은 Draft·미병합. 중복 패치·법률 자동 인정 승격 없음.

## A1-CALC-012 — 36/48/60개월·납부일/부분구간 [ ] (계산사무장)

- main `lib/repayment-plan-model.ts` blob `6b9e53caba3be1eab17373956aa19717cfeec980` 실제 `buildRepaymentPlanModel`와 `lib/plan-reconciliation.ts` blob `1c895fd2fd8a133368315532ed2ab9984d64b2e3` 실제 `reconcilePlanLedger` 함수 V8 격리 실행. 합성 채권 d: principal 999999원/interest 0원, 월 지급 20원, 회생위원 보수 **명시된 0원**, caseRevision 1, start 2026-01-31, source-only 종단이 아닌 함수 검증.
- 독립 예상 vs main 관찰 총 **9조건 중 7 일치**, 미병합 [Draft PR #37](https://github.com/firmengine/firmengine/pull/37) `plan-reconciliation.ts` blob `153aa741124344ffecc6d5db38130415aada9bfb`에서 **9/9 기대 일치**.
  1. 36회차: 원금 36행+보수 36행, 마지막 2028-12-31, `complete/reconciled` 일치.
  2. 48회차: 48+48, 마지막 2029-12-31 일치.
  3. 60회차: 60+60, 마지막 2030-12-31 일치.
  4. 36회차 18+18 구간, 두 번째 2027-07-31: 마지막 2028-12-31 일치.
  5. 구간 19회차 누락: `MISSING_OR_DUPLICATE_MONTH` blocked 일치.
  6. 존재하지 않는 2026-02-29: `INVALID_PAYMENT_DATE` blocked 일치.
  7. **reviewed=true·36회차 납부일 전부 null**: 독립 기대 blocked; main은 ledger `complete`·reconcile `reconciled`, PR #37 reconcile `blocked` 및 납부일 누락 36개 — **기존 결함 재현**.
  8. reviewed=false·날짜 미관찰: ledger `provisional` 유지(정산 결과는 산술 `reconciled`일 수 있음), 최종 승격 금지 경계 일치.
  9. reviewed=true·18+18의 후반 18회차 날짜만 null: main `reconciled`, PR #37은 `blocked` 및 누락일 18건 — 기존 결함 재현.
- 법원에서 36·48·60개월 변제기간 또는 예외 기간을 인정하는지와 납부기일 확정은 별도 실무 판단. PR #37은 Draft·미병합이며 실제 D5110 공식 양식·DOCX·D1/브라우저 E2E 미실행.

## 결론·인수 경계·인계

- **기존 P1 미병합 2경계 재확인** (자동초안 최신 source/lease CAS, reviewed 변제기일 null). 신규 확정 결함·신규 패치·신규 PR **0**. 세 A1 ID 모두 `[ ]` 유지. **제품 전체 인수 완료 0**.
- 실제 실행 요약: URL 함수 7/7, 자동초안 기계 게이트 11/11, 변제일정 main 7/9·기존 PR #37 9/9. 파일/메서드/SQL predicate는 **정적 검증**이며 테스트 숫자에 합산하지 않음. V8에서 import와 TS 타입만 제거한 함수 단위 실행이고 원본 Node test suite·CI 통과 아님.
- 미실행: 전체 Node/TypeScript/lint/build/CI, 브라우저 클릭·HTTP/실 DB/worker 경합, Cloudflare staging D1/R2/Cron, 실제 고객 PDF/OCR·85종 완전 흐름, 공식 서식·변호사 승인·운영 배포·전자제출·법원 인가.
- 데이터 분리: 미관찰 날짜 `null`은 관측된 납부액 `"0"`과 다름. 내부 `complete`/산술 `reconciled`는 법률 승인/전자제출 가능과 다름. source-only/승인전·conflict/비해당 상태를 임의 확정하지 않음.
- 다음 53차 역할 **서류담당자/변호사/데이터담당자**; 추천 **A1-DOC-003**(상담 변경 후 목록 재평가), **A1-LAW-004**(채권 유형별 판단 분기), **A1-DATA-003**(미관찰/0/상충 보존). 기존 Draft PR #17/#37과 병합 충돌·회귀 확인 우선.
