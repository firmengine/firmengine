# FirmEngine AX A3 r60 — canonical OCR #481–500 증거·계산·법률·서식 소비처 심층 재감사 (2026-11-02 KST)

## 범위·기준·이어받기

- 시작 GitHub `main` HEAD: `e050b8ca48885ad44b94354945c8fff3c6585fe5`. 문서 작성 직전 HEAD: `e050b8ca48885ad44b94354945c8fff3c6585fe5` (관련 8개 소스 blob 모두 시작 판본과 **동일**함을 재조회). 허용 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만.
- 이전 **r59 #461–480** 영수증 `20261101-r59-canonical-461-480-consumer-recheck.md`와 동일 범위의 과거 최초 **r25 #481–500** 영수증 `20261031-r25-canonical-481-500-1325KST.md`를 읽고 **재검사**. r25에서 확인한 material-서식 후보 공백 외, **적용조건 정확 ID 7건 미등록**을 이번에 별도 확인함.
- 최근 GitHub 커밋/PR 및 관련 스키마를 읽음: PR #51(기간 술어; open Draft), #131(보험 자산 후보; open Draft), #145(A2 계산 단위; open Draft). 다른 에이전트 PR/코드 파일은 덮어쓰지 않음.
- 전체 인덱스 **693 유일 canonical ID**, 증빙서류 **85**, 추출 패밀리 **48**, 문서×패밀리 경로 **141**, 선언 원천 슬롯 **1,808**을 실제 최신 JSON으로 전수 조인. 이번 **#481–500 20개 / 59 슬롯 / 4 서류 / 1 추출 family**. 4개의 동일 원천 선언은 4개 실제 관측값이나 4개 자산이 아니다.
- 비교한 코드/계약: `canonical-field-id-index.json`, `document-agent-field-contracts.json`, `shared-document-field-contracts.json`, `field-applicability-contracts.json`, `reference-intake-catalog.json`, `document-agent-registry.ts::compactFamilyFieldContract`, `canonical-field-binding.ts`, `feature-lineage-audit.ts`, `ocr-chain-matrix.ts`, `material-calculation-source-gate.ts`, `db/schema.ts`, `case-requirements.ts`, `document-substitution.ts`, `preapproval-correction-item-store.ts`; 기존 `tests/feature-lineage-audit.test.ts`, 이전 영수증. 공식 eform parity는 `unverified`.

## 서류 라우트와 20개 정확 ID별 소비처/공백

서류 route: **A** = `employment_history@pension_contribution_benefit`, **B** = `pension_certificate@pension_contribution_benefit`, **C** = `retirement_estimate@pension_contribution_benefit`, **D** = `pension_contribution_statement@pension_contribution_benefit`. 각 원천에는 **문서 SHA·페이지·원문 quote/bbox·행/대상 식별** 계약이 있으며, 4개 문서의 `recordPolicy.noCrossRecordBorrowing=true`를 확인. 이 값은 실제 원본 저장/재독 성과가 아닌 **정적 정책 선언**이다.

**공통 소비처:** 증거원장 `extraction_records` / `extracted_features` (`canonical_field_id`, 원본값, source state, 원문 인용, 페이지/행 등), 누락 인덱스 `extraction_field_coverage`. **직접 typed 0/20**, 18계산 91입력의 정확 자동 연결 **0/20**, 내부 공식 서식 token 직접 선언 **0/20**, 위험95·규칙50·예외46의 정확 ID 증거계약 **0/20**, 실제 법률 승인 **0/20**. 나머지 미소비 자료는 source-only 증거로 보존한다. 미등록·미승인 요구의 자동 합격은 **0%**.

| # | canonical ID | 문서 (원천 슬롯) | datatype / unit | 주체 / 시간 역할 | 정확 적용조건 | 계산/검토 역할 |
|---:|---|---|---|---|---|---|
| 481 | `pension_contribution_benefit::benefit_amount` | A,B,C,D (4) | `money` / `currency and exact source unit if monetary` | `member` / `not_applicable` | 등록 | source-only |
| 482 | `pension_contribution_benefit::benefit_type` | A,B,C,D (4) | `category` / `not_applicable` | `member` / `not_applicable` | 등록 | source-only |
| 483 | `pension_contribution_benefit::contribution` | A,B,C,D (4) | `money` / `currency and exact source unit if monetary` | `member` / `not_applicable` | 등록 | source-only |
| 484 | `pension_contribution_benefit::encumbrance` | A,B,C,D (4) | `category` / `not_applicable` | `member` / `not_applicable` | 등록 | source-only |
| 485 | `pension_contribution_benefit::issue_date` | A,B,C,D (4) | `date` / `source date format normalized to ISO without loss` | `member` / `document_issue_date` | 등록 | source-only |
| 486 | `pension_contribution_benefit::member` | A,B,C,D (4) | `party_role` / `not_applicable` | `member` / `not_applicable` | 등록 | source-only |
| 487 | `pension_contribution_benefit::payment_start` | A,B,C,D (4) | `date` / `source date format normalized to ISO without loss` | `member` / `effective_date` | 등록 | source-only |
| 488 | `pension_contribution_benefit::period_end` | A,B,C,D (4) | `date` / `source date format normalized to ISO without loss` | `member` / `statement_period_end` | 등록 | source-only |
| 489 | `pension_contribution_benefit::period_start` | A,B,C,D (4) | `date` / `source date format normalized to ISO without loss` | `member` / `statement_period_start` | 등록 | source-only |
| 490 | `pension_contribution_benefit::plan_id` | A,B,C,D (4) | `identifier` / `not_applicable` | `member` / `not_applicable` | 등록 | source-only |
| 491 | `pension_contribution_benefit::provider` | A,B,C,D (4) | `party_role` / `not_applicable` | `member` / `not_applicable` | 등록 | source-only |
| 492 | `pension_contribution_benefit::vested_balance` | A,B,C,D (4) | `money` / `currency and exact source unit if monetary` | `member` / `not_applicable` | 등록 | source-only |
| 493 | `pension_contribution_benefit::withdrawal_value` | A,B,C,D (4) | `money` / `currency and exact source unit if monetary` | `member` / `not_applicable` | 등록 | `must_reconcile → asset.grossValue` |
| 494 | `pension_contribution_statement::contribution_record_kind` | D (1) | `category` / `not_applicable` | `document_subject` / `not_applicable` | **미등록(P2)** | source-only |
| 495 | `pension_contribution_statement::paid_amount` | D (1) | `money` / `KRW` | `document_subject` / `not_applicable` | **미등록(P2)** | source-only |
| 496 | `pension_contribution_statement::paid_months` | D (1) | `integer` / `month` | `document_subject` / `not_applicable` | **미등록(P2)** | source-only |
| 497 | `pension_contribution_statement::payable_amount` | D (1) | `money` / `KRW` | `document_subject` / `not_applicable` | **미등록(P2)** | source-only |
| 498 | `pension_contribution_statement::payable_months` | D (1) | `integer` / `month` | `document_subject` / `not_applicable` | **미등록(P2)** | source-only |
| 499 | `pension_contribution_statement::standard_monthly_income` | D (1) | `money` / `KRW` | `document_subject` / `not_applicable` | **미등록(P2)** | source-only |
| 500 | `pension_contribution_statement::subscriber_type` | D (1) | `category` / `not_applicable` | `document_subject` / `not_applicable` | **미등록(P2)** | source-only |

### 발견 P2-1 — 연금 납부내역 문서확장 7개 정확 적용조건 미등록 (이번 재감사 신규 분리)

- #494–500 **7개**가 `shared-document-field-contracts.json:documents.pension_contribution_statement.fieldsByFamily.pension_contribution_benefit`에는 실제로 존재하지만, `field-applicability-contracts.json:families.pension_contribution_benefit.fields`에서 정확 ID를 찾을 수 없음. 등록 13/20, 미등록 7/20.
- `document-agent-registry.ts::compactFamilyFieldContract`는 `conditions?.fields.find(condition=>condition.id===field.global_field_id)?.sourceCondition??null`을 사용하므로 **확장 7개는 sourceCondition=null 경로**다. 이는 등록 공백이며 실제 법원 요구가 부적합하다는 확정 판정이 아니다.
- 해당 연금서류에는 원래 11개 문서 확장 ID가 있고 이번 범위는 7개. 전체 11개의 정책 등록 보강을 검토하되 **추정 조건/기본 0/자동 N/A를 코드에 하드코딩하지 말 것**. `contribution_record_kind`는 상세행/합계행 구분에, `paid_amount`·`payable_amount`·`standard_monthly_income`은 서로 다른 의미의 비합산 검산 증거에 사용 가능. 납부월수의 **month** 단위를 KRW로 변환 금지.

### 발견 P2-2 — 연금 인출가능액의 자산 후보와 원천 기간 경고의 경계 (r25 재확인)

- `pension_contribution_benefit::withdrawal_value` **#493**는 `MATERIAL_CALCULATION_SOURCES`의 유일한 `must_reconcile → asset.grossValue`이지만 `canonical-field-binding.ts`에 해당 family의 직접 typed projection이 없다. 승인된 별도 typed 자산행과 원천·주체·기준일의 명시적 결속이 없으면 검토 보류해야 함.
- 실제 `feature-lineage-audit.ts::reviewScope("pension_contribution_benefit")` V8 격리 결과 **forms=[EVIDENCE_INDEX]**, laws=[KR-ACT-589,KR-RULE-79,SEOUL-402]. `D5101` 자산, `D5103` 소득, `D5110` 서식 **후보 라우팅 공백**은 기존 r25와 동일. **법원 적용조건 확인 전 서식/계산 의미 변경 금지**; 계산사무장·변호사 승인 검토 후에만 별도 PR.
- `hasPeriod(role,family)` 현행 원본 술어를 59 슬롯에 실행: **59/59 true**, `hasUnit(datatype)`: **21/59 true**. temporal_role=`not_applicable`이면서 periodIdentity=true인 선언 슬롯은 **43**; 그중 22슬롯은 category/party_role/identifier 등 비금액·비기간 신원/구분 필드임. 43 모두 기간검사를 제거해야 한다는 판단은 **아님**(금액/월수는 기간 대조 유효 가능). PR #51은 #451 과세연도 검증 후퇴 후보가 있어 자동 병합 금지.
- #481 급여액(지급주기/세전세후 미분리), #483 기여금, #492 적립·귀속액, #493 인출가능액은 동일 계산값이 아님. #495 납입액, #497 납부예정액, #499 기준소득월액과 무단 합산 금지. #480 기준일(직전 회차), #485 발급일, #487 지급개시일, #488–489 명세기간 및 가입자/상품별 인출제약과 소유자 법적 확인 필요.

## 실제 실행 테스트: 기대 / 관찰 / 층위

| 검증 입력 | 독립 기대값 | 관찰 | 판정 범위 |
|---|---|---|---|
| 현재 원천 JSON 693/85/48/141/1,808, 중복 0 및 18산식/91입력·위험95/규칙50/예외46 | 동일 개수·고아/중복 없음 | 구조·계약 조건 **24/24 기대 일치** | JS **정적 계약 조인**; E2E 불가 |
| #481–500 인덱스 순서/원천 59슬롯/4서류/등록조건 | 20개·59슬롯·13개 등록/7개 미등록 | 정확히 일치 | ID별 정적 일치, 미등록 **불합격 유지** |
| 실제 `hasPeriod`/`hasUnit` 표현식 직접 실행 | family 정규식에 따라 각각 59/21 true | **59/59**, **21/59** | 현행 V8 함수 술어; 법률 필수기간 검증 아님 |
| `reviewScope` 실제 함수 본문 | pension_contribution_benefit은 일반 인덱스만 반환 | **EVIDENCE_INDEX** | 격리 함수 실행; 서식 최종 승인 아님 |
| `auditMaterialCalculatorSources` 실제 함수본문(타입 선언만 제거), mock CaseData/refs | 아래 9개 오류코드 각각 | **9/9 기대 일치** | V8 원본 함수 격리 + 합성 domain helper; 정식 Node/DB 아님 |

**material 합성 9개 기대→관찰:** `#493 present/no typed → CALC_INPUT_UNCONNECTED_MATERIAL`; `typed 100/원본100·unreviewed → issue 0, automaticLegalRecognition=false`; `typed110/원본100 → CALC_INPUT_AMOUNT_MISMATCH`; `2 typed 자산에 같은 Fact 연결 → CALC_INPUT_MULTIPLE_TYPED_MATCHES`; `numeric=null → CALC_INPUT_AMOUNT_INVALID`; `explicit_none → issue 0(0원 의미 아님)`; `disputed → CALC_INPUT_SOURCE_INVALID`; `#481 benefit_amount source-only → issue 0`; `#495 paid_amount source-only → issue 0`. 전부 예상 코드와 실제 관찰 일치. **material 검사 이슈 0은 법률상 인정 또는 실제 자산 합산 승인과 다르다.** 테스트 준비시 첫 JS 타입제거 컴파일 오류를 수정한 뒤 정상 9회 실행했고, 전체 Node/CI는 수행하지 않았다.

## 6역할 체크리스트: 본 회차 5개 선택 (모두 [ ] 유지)

- **AX → IT → 사용자·서류 → 계산사무장 → 변호사** 순환 (직전 r59 DATA 시작 다음 AX 시작). 데이터 담당은 다음 회차 우선.
- `A3-AX-019`: 연금 benefit_amount / contribution / vested_balance / withdrawal_value 및 납부·월수·기준소득은 다른 의미; 자동 합산/이름 유사 alias 차단 검토. 정확 적용조건 누락 7개 및 0 typed 확인. **미완**.
- `A3-IT-020`: 사용처 0개도 원본/문서별 59개 선언 슬롯, source hash/행 보존 계약 확인. 실 D1 재독·업무 사유 큐 **미검증**.
- `A3-DOC-006`: 4서류 59슬롯, 가입자·상품번호·기간·상세/소계/금액과 추가서류·갈음·보정 연결 필요. 실제 발급·문서 접수·대체승인 **미검증**.
- `A3-CALC-008`: #493 material gate 합성 9/9, typed 없음/중복·불일치 차단 확인; 18개 실계산·같은 자산의 인출가치·면제/담보·청산가치와 원단위 재독 **미검증**.
- `A3-LAW-014`: 연금/퇴직금의 소득/재산 분류, 인출가능성·보호·청산가치 비교를 공식 법령/관할·변호사 승인까지 확정하지 않음. 정확 법률 증거계약 0/20. **미완**.

## 다음 시작 / 안전 경계 / 소스 증빙

- 순차 심층 재감사 **500/693 = 72.2%**, 잔여 **193개**. 다음 **#501 `pension_contribution_statement::unpaid_amount`** (#501–520), **DATA → IT → DOC → CALC → LAW** 우선 역할 순환.
- A3 총 **124 체크 ID**, 완료 [x] **0개**. 전체 Node/CI/빌드, 실제 OCR PDF, staging D1/R2/Cron, 공식 법원 전자서식 검증, 법률/세무·변호사 검토, 운영 사이트 배포는 **미관찰/미인증**. 실제 고객 정보·OCR 사실값·키·.env·비공개 정답 없음.
- 실제 코드 및 정적 계약의 출처는 `main`의 아래 blob SHA를 기준으로 함: index `27ecdddd208de82a2f5c675e7482485e3a8838c2`, family `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`, shared `9decab974e0909ae24ad927bdfe241d75b71f3a9`, applicability `6076b26f782c4643a21a7b2f1a8f6261bb588b68`, lineage `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`, material `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`, calc `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`.
- **제품 코드·실행 DB·파일저장·운영 배포·D1 운영 migration·전자제출·법원 인가 확정은 수행하지 않음.** 미등록 요건을 자동 합격/비해당/0으로 승격하지 않음.
