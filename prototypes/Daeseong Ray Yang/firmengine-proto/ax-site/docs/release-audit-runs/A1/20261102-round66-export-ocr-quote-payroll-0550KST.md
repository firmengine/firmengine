# FirmEngine A1 66차 — Export 원자성 · OCR 문구/숫자 상태 · 12개월 급여 평균

- 일자: 2026-11-02 KST. 직전 65차 서류담당자·변호사·데이터담당자 → **66차 IT담당자 / AX담당자 / 계산사무장**.
- 저장소: `firmengine/firmengine`, 작업 허용 경로 **`prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만**. 감사 시작 및 신규 수정 브랜치 기준 main **`52571dd5bc0d52459dedd5f575dfcc042fe861c0`**; 감사 영수증 작성 직전 재조회 main **`52571dd5bc0d52459dedd5f575dfcc042fe861c0`**.
- 중앙 인수 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`, 세 미완료 ID **A1-IT-008 / A1-AX-003 / A1-CALC-001**. 전 회차 65차 영수증과 과거 36차 영수증, 최근 커밋·Draft PR(#24/#61 등), schema `db/schema.ts`, 실제 메인 소스와 테스트를 확인함.
- 실증은 GitHub에 저장된 실제 함수의 **TypeScript 표기만 국소 제거한 V8 함수 격리 실행** + 합성 비식별 입력·의존성 메모리 스텁. Node 프로젝트 원본 테스트·CI·실 D1/R2/Cron·OCR 모델·법원 서식/실무자 승인/사이트 배포와 **다른 층**이며 수행하지 않았음. 고객정보·원본 OCR·키·.env 없음.

## A1-IT-008 — Export manifest D1 커밋 ACK 유실

- main `lib/export-artifact-transaction.ts` blob **`a114235e5b5de57b5ae58b41026f939ee8543174`**; 기존 `tests/export-artifact-transaction.test.ts` blob **`a684612f61234a9fb0ac30261684733ba749eefc`**.
- 실제 `commitExportArtifactTransaction` 함수 본문을 추출해 합성 R2 Map / SQL artifact Map / D1 manifest 배열과 실패주입 callback으로 **7조건 실행, 6/7 독립 기대 일치**.

| 시나리오 | 독립 기대 SQL/R2/manifest | main 관찰 SQL/R2/manifest | 판정 |
|---|---|---|---|
| 정상 | 1/1/1 | 1/1/1 | 일치 |
| R2 upload 오류 | 0/0/0 | 0/0/0 | 일치 |
| artifact SQL 부분 실패 | 0/0/0 | 0/0/0 | 일치 |
| 명시 manifest 거절 | 0/0/0 | 0/0/0 | 일치 |
| **manifest 실제 반영 뒤 ACK 유실** | **1/1/1 보존** | **0/0/1 파괴적 정리** | **불일치, 기존 P0 재현** |
| 커밋 후 이벤트 로깅 실패 | 1/1/1 | 1/1/1 | 일치 |
| 중복 artifact target | 0/0/0 | 0/0/0 | 일치 |

- 원인은 manifest write 예외가 실제 커밋 여부 불명확 상태인데도 catch에서 SQL row와 R2 object를 삭제하기 때문. **기존 Draft PR [#24](https://github.com/firmengine/firmengine/pull/24) 및 [#61](https://github.com/firmengine/firmengine/pull/61)** 미병합으로 코드 중복작성하지 않음. #61은 별도 요청원장/재실행 계약을 추가하므로 동시 사례·고아 정리·staging ACK 장애주입은 인수 전 필요. 실 운영 사고 주장 아님.

## A1-AX-003 — OCR 독립 대조 문구·숫자와 중간 상태의 어긋남 (신규 P2 후보)

- main `lib/extraction.ts` blob **`75931aad3fc7871395e62276bb5533e24b15d1a5`**, `lib/source-verification.ts` blob **`af5999723f6ceab99d70ba66acf9e9c465189571`**, `lib/source-verification-identity.ts` blob **`acdecd4e18970fe4faf6eb91dd4aefc97b83236b`**. 기존 `tests/extraction-semantics.test.ts` blob **`a25eca51d33a6424ffe9c310290bf0c3b8f9be5c`**; `lib/field-observation.ts` blob **`c96954c09fa426e0dba5db2e5f787e2f3b880f19`**.
- 합성 원문 `기본급 2000000원` / 추출 value `2000000`, bbox `[0.1,0.2,0.3,0.3]`. 독립 verifier가 `agrees`라고 기록했으나 `성과급 2000000원` 또는 `임대료 2000000원`을 인용하면 같은 수치여도 **다른 출처 문구**이므로 support 금지. `validAgreement` main은 `check.quote`가 공백이 아닌지만 검사하고 실제 추출 quote와 겹치는지 대조하지 않음. 또 불일치한 숫자/단위에도 `verifierDisposition` fallback이 중간 상태 `supported`를 반환함.
- main 실제 `validAgreement` 9합성 입력 **7/9 기대 일치**. 실제 `applyFirstVerification` 및 `getRepairTargets` 원본문 **6조건 중 3/6 독립 기대 일치**:
  - 정확한 인용 → `supported`, target 0 (정상).
  - `성과급 2000000원`으로 다른 인용 → **`supported`, target 0** (기대 `unclear`).
  - 숫자 `3000000` 불일치 → **confidence `uncertain`인데 state `supported`** (기대 `unclear`).
  - 단위 `만원` 불일치 → **confidence `uncertain`인데 state `supported`** (기대 `unclear`).
  - 검증 누락 → `missing_check` (정상).
  - bbox 불연속 → `conflicting` (정상).
- 최종 trusted `source-verification.ts::matchingAgreement`는 별도로 `sourceQuotesOverlap`를 검사하므로 **이 반례 자체가 최종 Fact 법률 승인/법원 제출로 잘못 승격되었다는 증거는 아님**. 중간 검토표의 거짓 `supported`와 repair target 미발행이 확정된 국소 결함.
- 보수적 수정은 Draft [**PR #158**](https://github.com/firmengine/firmengine/pull/158), branch `audit/a1-r66-ocr-quote-status-20261102`, PR HEAD **`d439cc68b8d0da303ca3e4bb9cf00ddd7b38271a`**. `lib/extraction.ts` 수정 blob **`f56b958022b8c76f7fcfae02f7c27844bcf322c3`**, 신규 `tests/extraction-quote-status-r66.test.ts` blob **`8aef4b543e9e708b6c550b5ffb415ee4dcbbc303`**.
- 수정 내용: 기존 `sourceQuotesOverlap`로 quote 결속; agreement 실패 뒤 중간 `supported` 강제 금지(`unclear` 유지); unresolved repair fallback 같은 경계 차단. **수정 GitHub 실제 함수 재실행 V8 8/8 기대일치**(동일/상충 인용·숫자·단위·누락·bbox·NFKC). 신규 Node `test()` 블록은 파일에 작성·Git 커밋했으나 **Node 실행은 미실행**. PR #77/#112와 같은 extraction 파일을 수정하므로 재기반·전체 테스트·UI 상태소비·실제 OCR·검수 담당자 확인 전 **Draft·미병합**.

## A1-CALC-001 — 급여 12개월 / 상여 / 공제 금액 흐름

- main `lib/assessment.ts` blob **`ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`**, `lib/canonical-field-binding.ts` blob **`60ee5c7762d52b72a165b4f4f8214680eb98f148`**, 기존 `tests/calculation-audit.test.ts` blob **`7c0d177ee363cb17bfcd0167981b1ea3f74539be`**.
- `monthlyIncome` + `monthSpan` + `aggregateIncomeObservations` **실제 원본문**에서 타입 표기만 제거 후, 결정적 원화·기준함수 의존성은 명시적 합성 stub로 연결해 **7/7 독립 기대 일치**.
  1. 2025년 12개월 기간합계 36,000,000원 / 12 → **3,000,000원**.
  2. 실제 12개월인데 명시 분모가 11 → **null + INCOME_PERIOD_DENOMINATOR_CONFLICT**.
  3. 1월 gross 2,500,000원, 공제/비용 400,000원, net 미관찰 → **2,100,000원 합성 계산**(법률상 공제 인정 확인은 별도).
  4. net 2,100,000원과 gross-expenses 2,400,000원 불일치 → **null + INCOME_NET_GROSS_EXPENSE_CONFLICT**.
  5. 1~11월 매월 2,000,000원, 12월 3,200,000원(상여 포함 관측 가정) → 12개월 총 25,200,000원 / 12 = **2,100,000원**, observedMonths 12.
  6. 같은 월 기본급 2,000,000원 + 상여 500,000원을 **구성요소로 사람 검토된 경우** → 2,500,000원, 관측 1개월.
  7. 같은 월 상여를 별도 구성 승인하지 않은 2행 → **null + INCOME_OVERLAPPING_OBSERVATIONS_REVIEW_REQUIRED**.
- 실제 canonical payroll `net_pay`는 typed `net`, `gross_total`은 gross, `total_deductions`는 expenses, 근무기간은 period_start/end. 반면 `payroll_payslip::income.payroll.bonus` 등 일부는 **source-only**이고 자동으로 별도 급여 구성이나 공식 인정을 확정하는 경로가 아님. 위 #5는 **이미 관찰된 월 net**에 12월 상여가 포함되었다는 가정이며 모델이 상여를 자동 합산·배분했다고 주장하지 않음.
- 급여 85서류 전종 PDF/OCR→693 필드→Fact→typed→18계산→95법률→문서 C01/C02/C04, 12개월 원본·원천징수/4대보험 실제 공제 및 관할·법원 인정/승인 **미검증**.

## 범위·인수 결론·인계

- 신규 P2 후보 **1건**, 신규 Draft PR **#158** (2파일·허용 경로 한정), 기존 P0 Export 재현 **1영역**. IT main **6/7**, AX main `applyFirstVerification` **3/6**·수정 원문 V8 **8/8**, CALC 원문 함수 V8 **7/7** 모두 **서로 다른 국소 독립 합성 조건**이며 제품 정확도로 합산하지 않음.
- 본 회차 모든 ID는 **[ ] 미완료**, 전체 인수 완료 **0건**. Node 프로젝트 회귀/lint/TypeScript/CI, staging D1·R2/Cron, 실제 OCR/서식·실무/법률 인정/운영 배포 **미실행**. 운영 DB 마이그레이션, 전자제출, 법원 인가 확정 **수행 안 함**.
- 다음 역할 **서류담당자 / 변호사 / 데이터담당자**, 다음 미검증 ID **A1-DOC-010**(발급일·발생기간·신청일), **A1-LAW-011**(청산가치·가용소득·수행가능성), **A1-DATA-010**(금액 단위/외화·0원).
- Extra High 모델 설정은 실행기에서 확인 불가. 추론 지침 수행 여부와 런타임 실제 추론 모드를 동일시하지 않음.
