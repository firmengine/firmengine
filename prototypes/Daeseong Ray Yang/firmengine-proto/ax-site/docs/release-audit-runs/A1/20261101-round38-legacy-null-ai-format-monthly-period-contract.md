# FirmEngine AX A1 제38차 — 구 사건 null / AI 원문환각 차단 / 12개월 평균 역검증

- 일자: **2026-11-01 KST**. 범위: `firmengine/firmengine` **main**의 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 이하에 한정.
- 시작 main: `5c692d178da2c7335beaacc96074f11341b50fed`; 영수증 등록 직전 main: `5c692d178da2c7335beaacc96074f11341b50fed`.
- 제37차 서류/변호사/데이터 이후 **IT A1-IT-011 · AX A1-AX-005 · 계산사무장 A1-CALC-005**로 역할 순환. 중앙 `PRODUCT_RELEASE_INTEGRATION_BOARD.md`, 제37차 영수증, 최근 main 커밋·open PR, `db/schema.ts` 및 관련 실제 소스/기존 테스트 읽음.
- 합성 입력만 사용. V8 독립 함수 격리는 **실제 GitHub 소스의 함수 본문**에서 TypeScript 타입 부분만 제거, Node/원격 API/DB 의존함수는 별도 합성 대체. 따라서 실행 결과는 **소스함수 격리 검증**이지 전체 Node/CI/D1/R2/E2E 검증 아님. 실제 고객/원문 OCR/비밀값/키/비공개 정답 전혀 사용하지 않음.

## A1-IT-011 — 구 사건 JSON의 결측과 명시 null

- 확인한 main: `lib/case-workflow-state.ts` blob `e43ffe37a4f832d6f486633a6c7ae9054bb4e8d1`, `lib/case-schema-migration.ts` blob `94f57d2a7da704bfc5cfb476ffa786a5c6c392af`, `lib/server-store.ts` blob `32350bd5045da89ea327f3c77fab6d2d19fbac56`, `lib/case-commands.ts` blob `d18c555f04f65687c509a8e8d35aba4bb3597378`; `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`. 기존 `tests/case-schema-migration.test.ts` 확인.
- 독립 기대: (a) 구판본에 **누락**된 선택적 업무 배열은 명시적 마이그레이션/안전 기본값 아래서 조회 가능, (b) 과거의 명시적 **null**은 완료/0/비해당 배열로 함부로 승격하지 않아야 하며, (c) 소비 측은 TypeError/500이 아니라 검토 필요 상태로 제어해야 함.
- `caseWorkflow` 실제 본문 V8 합성 5조건 관찰: 상태 전체 미입력→빈 배열·version1, 구판본 필드 일부 누락→빈 배열·기존 version3 유지, `tasks:null`→**null 그대로**, `requirements:null`→**null 그대로**, futureReceipt 추가 필드→보존. 데이터 조용한 승인/값대체는 관찰되지 않았음. 그러나 `case-commands.ts`의 `work.tasks.findIndex` 및 `case-workflow-server.ts`의 `workflow.requirements.some`는 null을 수용하지 않는 코드 경로. 실제 HTTP 경로 500 재현은 **미실행**; 타입/역호환 제어의 잠재 P2 위험으로 기록.
- 마이그레이션은 explicit allowlist/revision/hash 및 미래 스키마 보존 규칙을 갖지만, **명시 null** 처리의 계약/실무 의미 결정과 통합 HTTP 회귀가 필요. 'null→[]' 자동 치환은 미관찰→없음 승격 위험으로 코드 수정하지 않음. **[ ]**.

## A1-AX-005 — 문서에 없는 금액·날짜·법률 결론 환각 차단

- main `lib/ocr-calculation-input.ts` blob `8f7f51bf41f7c944b76419d7cc894e49ac771473`; `lib/intake-source-spans.ts` `a35823837a501f48662643f21c99f6b64f1824b2`, `lib/intake-store.ts` `c0bdea9443a018a46c080a8e39a74a0daf62759f`, `lib/source-verification.ts` `af5999723f6ceab99d70ba66acf9e9c465189571`, `lib/luna.ts` `e8ad1246888e42087cf94ef792c8285cae2541d1`.
- `calculationSourceCellIssues` 실제 함수 본문 V8 5조건: 원문 quote 없는 금액→`SOURCE_QUOTE_MISSING`; 합성 `value=9999999, quote='급여 100만원', unit='원'`→`issues=[]`; `value='2026-10-01', quote='상담했습니다'`→`issues=[]`; USD 금액→`SOURCE_MONEY_NOT_EXACT_KRW`; unreadable→`SOURCE_READ_UNCERTAIN`. 독립 기대와 5/5 일치 **(이 함수는 주석대로 '형식만' 점검함)**.
- 인입 상담에는 `resolveIntakeSourceSpanRefs`→`validateIntakeClaims` 연결, OCR엔 독립 verifier/출처·bbox 수신증 검증 함수가 존재. 따라서 위 두 `issues=[]`는 **환각이 제품에서 채택되었다는 뜻이 아님**. quote 존재와 quote 내용의 사실 일치/원본 해시/독립 판독/최종 법률 승인 단계의 종단 검증이 남아 있음. 모델 API·실제 PDF·법률 결론 생성 E2E는 미실행. '원문 정확도 통과' 절대 금지, **[ ]**.

## A1-CALC-005 — 명시 1개월 증빙을 12개월 관측으로 오승격 가능 (신규 P1 후보)

- main `lib/assessment.ts` blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`, `tests/calculation-audit.test.ts` blob `7c0d177ee363cb17bfcd0167981b1ea3f74539be`.
- 실제 `monthlyIncome` 함수 격리: 합성 `net=1000000 KRW; amountBasis=monthly; periodStart=2025-01-01; periodEnd=2025-12-31; periodMonths=1` → **main 금액 1000000, issues=[]**. 독립 기대는 **null + INCOME_PERIOD_DENOMINATOR_CONFLICT**. 같은 종류의 2개월 span/1개월 선언과 명시 0원도 기존 main이 오수용. period_total 반례는 기존 차단됨.
- 원본 본문 7개 독립 조건 중 **4/7** 기대 일치(불일치 3). 원인: `period_total`은 명시 기간수와 달력 기간수 비교, `monthly`은 비교하지 않음. `aggregateIncomeObservations`는 완전 달력 span을 근거로 `duration=12`/observedMonths를 계산하므로 원천 메타데이터의 모순이 다월 증빙으로 오표시될 위험. 단, **실제 전체 calculateCase·계산 head·법원 제출값까지 이 반례가 전파됐는지는 미실행/미확인**.
- 별도 **[Draft PR #101](https://github.com/firmengine/firmengine/pull/101)**: 브랜치 `audit/a1-r38-monthly-observed-month-contract-20261101` HEAD `791c0bf8c35c44280c4cc5122c13a7f082053f00`, 수정 소스 blob `654b9e0fc98cf3c945fe77a9bc08c970e34fcc5c`; 새 회귀 테스트 blob `86a1fdfd6b60fc78f2fcdf0ef3867d574eeb38d0`. 월별 `periodMonths`가 **명시**되고 정상 달력 span과 불일치할 때만 기존 오류 `INCOME_PERIOD_DENOMINATOR_CONFLICT` 적용. 금액 계산식·법률 적용판본·법원 인정상태·승인절차·운영 데이터 변경 없음.
- PR에 커밋된 실제 함수 재조회/V8 합성 **9/9 기대 일치**(1개월 정상, 12span/1개월 불일치, 2span/1개월 불일치, 명시 0 충돌, period_total 충돌, 명시 12개월 일치, 기간수 생략, 정상 명시 0 등). Node 회귀 **4블록 작성/커밋했지만 실행하지 않음**.
- PR #67(부분월), #79(무효 filingPeriod), #96(미승인 집계분류)도 동일 `assessment.ts`를 수정하는 미병합 Draft. 충돌·순서 검증과 계산사무장 실무 검토 후 통합 필요. `periodMonths` 미관찰 값은 계속 보수적으로 검토, 12개월 월별 실제 12증빙을 뜻한다는 법적 인정은 **절대 아님**. **[ ]**.

## 요약·이후

- 이번 체크 **A1-IT-011 / A1-AX-005 / A1-CALC-005 모두 [ ] 미완료**. 신규 P1 후보 1건, PR #101 수정 코드 1파일+새 Node 회귀 1파일(모두 허용 ax-site 내부). IT 명시 null 계약 공백과 AX quote 사실성/검수 경계는 별도 미검증 위험.
- **실행 구분:** main V8 IT 5조건(결측/명시 null 차이 관찰), AX 형식함수 5조건(계약대로 동작), CALC main 4/7 vs 브랜치 9/9. 총량을 전체 정확도/전체 CI로 치환하지 않음.
- 다음 순환: **서류담당 A1-DOC-014**(수정 OCR 원문·정정값 충돌), **변호사 A1-LAW-015**(동일인 독립 승인), **데이터 A1-DATA-014**(18계산·입력91 typed 소비 연결).
- 실제 Node 프로젝트 테스트/CI, staging D1/R2/Cron, 실제 모델/브라우저, 전체 85서류/18계산/95법률·법원 공식서식·직원/변호사 승인 **미수행**. 운영 배포/운영 마이그레이션/전자제출/법원 인가 확정 **미수행**. 실제 Extra High 모델 모드 확인 불가. 
