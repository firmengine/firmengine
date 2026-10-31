# FirmEngine A3 r41 — canonical #101–120 소비처 심층 재감사 (2026-11-01 KST)

> **승인·실증 구분:** 본 문서는 공개 GitHub `main`의 계약/코드 및 일부 원본 술어의 **V8 격리 실행**만 증명한다. 실제 고객 OCR, SQL/D1 저장·재독, native Node·전체 CI, staging R2/Cron, 공식 법원 서식 대조, 변호사 승인, 사이트 배포/운영 마이그레이션/전자제출 **미실행**. 고객자료, 개인정보, 키, env, 원본 OCR 사실값 기록 없음.

## 1. 최신 소스·지난 회차 승계 및 역할

- 읽기 시점 main HEAD: `7e33cd43a356d9a2a0463986992367eb6faffa6b`. r40 `#081–100` 영수증 [r40](20261101-r40-canonical-081-100-consumer-recheck-0422KST.md) 다음 정확 **#101**부터 시작; 기존 [r06 #101–120](20261030-1823-canonical-101-120.md) 선행 조사와 최신 코드/정책 비교.
- 최근 GitHub main 커밋·open Draft PR 탐색, 이전 [Draft PR #34](https://github.com/firmengine/firmengine/pull/34)(금액 원본/정규화 상충) 미병합 확인. 신규 [Draft PR #109](https://github.com/firmengine/firmengine/pull/109)(기간 관찰상태) 생성. 두 PR은 같은 파일 다른 인접 구간에 수정: **동시 병합 금지, merge 충돌·합성/Native Node 회귀 검토 필요**.
- 소스/blob SHA: index=`27ecdddd208de82a2f5c675e7482485e3a8838c2`; base=`9884b3fecf44643fefcdc4a421ed66ffc5477b3a`; shared=`9decab974e0909ae24ad927bdfe241d75b71f3a9`; supplement=`63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`; applicability=`6076b26f782c4643a21a7b2f1a8f6261bb588b68`; lineage=`de81bc3b8c460b8a4dde3fda9e13087e619e74ff`; binding=`60ee5c7762d52b72a165b4f4f8214680eb98f148`; material=`0286b44484913b63fa8ec3f7bf0ca59b034d0dab`; business-source=`0b796d9c3bc608c1224c5f9a049c80b6951a8b74`; business-net=`60a4fc295943dce404a7f99efffe88f58dd2d4ff`; extraction=`ec3f6b9d3ad8bf5f9ce4419a6816fadede378125`; form=`514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`.
- 이번 5역할 순환: **IT담당자 → 사용자·서류담당자 → 계산사무장 → 데이터담당자 → AX담당자**. A3-IT-003, A3-DOC-019, A3-CALC-019, A3-DATA-012, A3-AX-006을 순서대로 부분점검하였고 **5개 모두 [ ]**. 다음 회차는 변호사부터.

## 2. 693 ID / 1,808 source slot 및 실제 계약 열거

- 최신 JSON 원본의 canonical `ids` 배열 **693개를 실제 순서대로 검사**, 고유 693; 85개 shared documents, 48 family; base + document extension + supplement를 `document × family × global_field_id`로 전체 조인해 **1,808개 슬롯**. 중복 동일 route 0, 고아 ID 0, index 누락 route 0. 각 source slot은 **별도 관측·승인된 경제사실을 뜻하지 않는다**.
- 이번 **20/693 IDs**는 #101–120, **80 source slots / 고유 서류 10종**; 전체 **20/20 적용조건 등록**(source-conditional 선언일 뿐 실제 사건 필수·승인 아님), 각 ID에 원천 위치·원문 인용·page·source hash·record/field ordinal 증거보존 계약 존재. 문서 10종의 `recordPolicy`에 `noCrossRecordBorrowing=true`, `one_source_entity_event_or_period_per_record` 있음. 실제 page·복수행·실제 대상·귀속기간의 OCR 결과는 **0건 조회**: 선언과 관측 구분.
- 18개 계산/91개 입력 선언, 위험 95/법률규칙 50/예외 46 등록 규모 **최신 파일을 읽어 재집계**. 이번 20 ID에서 명시 `canonicalProjectionKey` 직접 typed **0/20**, `OCR_DECLARED_FORM_TARGETS` 정확 form token **0/20**, 위험/규칙/예외 JSON에 정확 canonical ID 정적 인용 **0/20**. 그러나 업무·원천 검토 소비처 및 일반 법률 workflow *후보*는 존재할 수 있다. 이 0을 **미사용/삭제/법률 불필요**라고 해석하지 않는다.
- material 계약: #101 `context_only`, #108 `context_only`, #113 `must_reconcile→income.net`; 그 외 17 ID는 해당 정확 material 항목 없음. `must_reconcile`은 실제 월소득 인정·산식 소비·원화 합산 승인이 아니다.
- 세 문서군: **G1** = business_income_report / financial_statement / sales_purchase_summary / operating_expenses; **G2** = income_source_inventory / business_contract / business_income_report / platform_settlement; **G3** = business_status_evidence / business_registration / business_contract / closure_certificate. 모두 각 4 route. **G1/G2/G3 합계 고유 문서 10종**.
- `feature-lineage-audit.ts` 원본 `hasPeriod`/`hasUnit` 표현식을 TS 타입만 제거하고 V8에서 **20×2=40회 평가**: 기간 flag `18`, 단위 flag `6`, 개별 `temporal_role=not_applicable`인데 패밀리명 때문에 기간 flag인 ID **#103, #106, #110, #114, #115 (5개)**. 문서 단위의 기간 확인과 *필드 자체 기간값*을 구분해야 하므로 검사조건 의미 **P2 재검토 후보**; 실제 OCR 거절은 미관찰.

## 3. ID별 정확 선언 / 원천·계산·법률·서식 실제/미관찰

표: **형식=datatype/canonical_unit**, **기간=temporal_role/subject_role**, P/U=원본 술어 period/unit 실행값. 아래 사용처는 원천검토·계산 *후보*이며, 실 승인과 분리. 모든 항목 **적용조건 등록**, 실제 값은 **미관찰**, 직접 typed/form token/정확 승인 법률계약 없음.

| # | 정확 canonical ID | 원천군(슬롯) | 형식/원단위 | 기간/대상 | P/U | 계산 원천 계약 | 실제 소스/검토 소비 또는 미승인 공백 |
|---:|---|---|---|---|:---:|---|---|
| 101 | `business_costs_and_ledgers::income.business_cost.gross_amount` | G1 (4) | money/KRW | period_scope/business_entity | Y/Y | context_only | business-source:cost_line / net preflight(COST.gross_amount) |
| 102 | `business_costs_and_ledgers::income.business_cost.payment_date` | G1 (4) | date/not_applicable | event_date/business_entity | Y/N | — | 원천 지급일 증거; 승인비용 산식 미연결 |
| 103 | `business_costs_and_ledgers::income.business_cost.payment_status` | G1 (4) | enum/not_applicable | not_applicable/business_entity | Y/N | — | 원천 지급상태 증거; 현금·발생주의 미결 |
| 104 | `business_costs_and_ledgers::income.business_cost.period_end` | G1 (4) | date/not_applicable | statement_period_end/business_entity | Y/N | — | business-source 기간종료 / net preflight 대조 |
| 105 | `business_costs_and_ledgers::income.business_cost.period_start` | G1 (4) | date/not_applicable | statement_period_start/business_entity | Y/N | — | business-source 기간시작 / net preflight 대조 |
| 106 | `business_costs_and_ledgers::income.business_cost.supplier` | G1 (4) | party_role/not_applicable | not_applicable/payee | Y/N | — | 거래처 증거·검산/역질문 후보 |
| 107 | `business_costs_and_ledgers::income.business_cost.tax_component` | G1 (4) | money/KRW | period_scope/business_entity | Y/Y | — | business-source:input_vat / net preflight 형제금액 검사(자동 차감 아님) |
| 108 | `business_current_income_summary::income.self_employment.business_costs` | G2 (4) | money_or_itemized/KRW | period_scope/business_entity | Y/Y | context_only | business-source:cost_summary (행별 비용 #101과 중복차감 금지) |
| 109 | `business_current_income_summary::income.self_employment.contract_end` | G2 (4) | date/not_applicable | effective_date/applicant_debtor | Y/N | — | 계약 종료일·소득지속성 증거, 승인 별도 |
| 110 | `business_current_income_summary::income.self_employment.contract_id` | G2 (4) | string/not_applicable | not_applicable/applicant_debtor | Y/N | — | 계약 식별자 증거; 문서간 동일 계약 판정 미승인 |
| 111 | `business_current_income_summary::income.self_employment.gross_receivable` | G2 (4) | money/KRW | period_scope/applicant_debtor | Y/Y | — | business-source:gross_receivable (미수·발생액) |
| 112 | `business_current_income_summary::income.self_employment.invoice_date` | G2 (4) | date/not_applicable | document_issue_date/applicant_debtor | Y/N | — | 계산서 발행일 증거; 현금 수령일 아님 |
| 113 | `business_current_income_summary::income.self_employment.net_receipt` | G2 (4) | money/KRW | event_date/applicant_debtor | Y/Y | must_reconcile→income.net | business-source:net_cash_received / material income.net 필수대조 (수령일 미확인) |
| 114 | `business_current_income_summary::income.self_employment.operator` | G2 (4) | party_role/not_applicable | not_applicable/applicant_debtor | Y/N | — | business-identity-crosswalk 운영자 증거 |
| 115 | `business_current_income_summary::income.self_employment.payer_customer` | G2 (4) | party_role/not_applicable | not_applicable/payer | Y/N | — | 지급자/고객 증거; 실명 대조 승인 전 |
| 116 | `business_current_income_summary::income.self_employment.service_period_end` | G2 (4) | date/not_applicable | statement_period_end/applicant_debtor | Y/N | — | business-source 용역기간 종료일(수령일 아님) |
| 117 | `business_current_income_summary::income.self_employment.service_period_start` | G2 (4) | date/not_applicable | statement_period_start/applicant_debtor | Y/N | — | business-source 용역기간 시작일(수령일 아님) |
| 118 | `business_current_income_summary::income.self_employment.withheld_tax` | G2 (4) | money/KRW | period_scope/applicant_debtor | Y/Y | — | business-source:withheld_tax (소득 재합산 금지) |
| 119 | `business_registration::business_entity` | G3 (4) | party_role/not_applicable | not_applicable/business_entity | N/N | — | 사업자 증거/교차확인 후보 |
| 120 | `business_registration::business_id` | G3 (4) | identifier/not_applicable | not_applicable/business_entity | N/N | — | business-net preflight REG.business_id / identity-crosswalk |

- 소스 검토의 근거: `business-source-evidence.ts`에서 cost_line·input_vat·cost_summary·gross_receivable·net_cash_received·withheld_tax 6역할을 별개 기록하고 기간 보조 슬롯을 연결; `business-net-reconciliation.ts`의 `preflightBusinessNet`는 #101/104/105/단일 행의 비용범주 #100/사업자 #099, VAT 매출 및 #120 사업자등록 ID를 **검토 후보**로 읽는다. `business-identity-crosswalk.ts`는 #114 운영자 등을 교차검토. `form-mapping.ts`의 결과 token은 승인된 원본 OCR→서식 직결을 뜻하지 않는다.
- **금전값 비합산:** #101 비용행과 #108 비용요약 이중 차감 금지; #107 부가세와 #118 원천징수세액은 매출/비용/순소득 별개; #111 미수채권과 #113 실수령액은 발생·수령 사건과 기간이 다름. #113 `event_date`인데 해당 가족에는 확정 실제 현금 수령일 슬롯이 없으며, 소스 감사 구현이 `periodOverlap=unknown`으로 보수적으로 표시하는 분기 존재. 실제 계좌 입금일, 지급자·사업자, 소득지속성, 승인비용범주, 결제/귀속기간의 **실무 검토 전 법률 인정·계산 승격 불가**.
- **DB 증거 계약 vs 실사용:** `extraction-row-store.ts`는 `extraction_records` / `extracted_features` 및 `extraction_field_coverage`와 raw, page, ordinal, hash, sourceState 저장·조회 *코드*를 선언한다. 실제 staging/운영 D1 Fact→typed projection·read-back은 **실행하지 않았다**. null/미관찰/관측 0/명시적 없음/비해당/상충/source-only/승인전을 동일하게 판정하지 않는다.
- **법률/서식/갈음·법원 보정:** `risk-catalog`/법률규칙/예외의 정확 canonical 조인 0과 권장 D5103/D5110 후보 표시를 실제 법원 필수 서식 token/관할별 요건 승인으로 해석하지 않는다. 서류 갈음 B+C 및 법원 보정명령에서 이 20개 ID의 실제 필요/완료/보류 소비 E2E는 **미관찰**. 근거·실무자 승인 전 0% 합격, 원천 폐기/무단 원화환산 금지.

## 4. 신규 P1 — 미관찰·상충 기간을 과거 원천으로 오인하여 zero-income 검토 제외

- `lib/business-source-evidence.ts` main blob `0b796d9c3bc608c1224c5f9a049c80b6951a8b74`의 `fieldDate()`는 기간 Fact의 `state`/`recognition`/validation/refs/날짜 형식은 확인하지만 `fieldObservation.sourceState`를 확인하지 않는다. 과거 2024-01에 sourceState가 `conflicting`, `not_seen`, `explicit_none`이어도 `outside`로 분류되어 `relevant`에서 제외되고, 미대조 현재 source 검토 경고 `zeroIncomeWouldBeUnsupported`를 약화시킬 수 있다. **실제 고객 소득 0 인정 발생은 입증하지 않았다.**
- 독립 기대오라클: **실제로 받아들일 수 있는 원천 기간이 확정된 경우에만 `outside`; 미관찰/상충/명시적 없음/중복/refs 없음은 `unknown`으로 보존**. 원본 `fieldDate`와 `periodOverlap` 표현식을 저장소에서 추출해 타입·non-null TypeScript 구문만 제거, V8 격리 실행. `validSourceRef`는 true stub, 가상 데이터는 공개로 안전한 합성값. 외부 CaseData/계산 엔진·SQL은 사용하지 않음.

| 합성 시나리오 | 독립 기대 | main 원본 관찰 | Draft PR #109 수정안 관찰 |
|---|---|---|---|
| 정상 과거 2024-01 | outside | outside | outside |
| 과거 + conflicting | unknown | outside | unknown |
| 과거 + not_seen | unknown | outside | unknown |
| 과거 + explicit_none | unknown | outside | unknown |
| 과거 + 원천 refs 없음 | unknown | unknown | unknown |
| 과거 + 중복 기간시작 필드 | unknown | unknown | unknown |
| 정상 현재 2025-01 | inside | inside | inside |

- 원본은 **4/7 기대 일치, 3/7 false-negative**, 수정안은 **7/7 기대 일치**. `fieldObservation`이 있을 때 `sourceState=present`일 것을 요구하는 좁은 게이트만 [Draft PR #109](https://github.com/firmengine/firmengine/pull/109)에 추가. 실제 import 기반 `tests/business-source-evidence.test.ts`에 `conflicting/not_seen/explicit_none` 3상태 및 정상 과거 `present` 회귀 두 블록을 작성/커밋했으나 **native Node 실행·CI 검증은 하지 못했다**. PR #34(금액 게이트)의 변경과 파일이 같으므로 함께 회귀 후 승인필요.
- 이전 [Draft PR #34](https://github.com/firmengine/firmengine/pull/34)의 `Fact.value`/`rawValue`/`numeric` 및 금액 검증 공백은 **main에 계속 남아 있음**. 기간 이슈와 금액 이슈는 분리해서 판정. PR #109는 날짜 원본 문자열을 무조건 ISO로 강제 비교하지 않아 적법한 날짜 정규화를 임의 거부하지 않으며, 모든 `not_applicable`을 자동 법률 면제로 승격하지 않는다.

## 5. 독립 실행 검증 및 합격의 의미

- 전수 JSON 구조 불변식 기대: 693 고유 ID, 85문서, 48패밀리, 1,808 routes, #101–120 80 routes, 적용조건 20/20, 18 계산/91 입력, 법률 95/50/46 → **모두 실제 최신 JSON 집계와 일치**; no duplicate route/orphan.
- 일부 원본 JS 술어 V8 **40회**, 법률/서식/typed 직접 계약 정적 검색. 새 P1 동일 7개 합성 입력으로 원본/수정안 각각 7회 격리 실행; 이것은 전체 실제 Node 단위테스트·Cloudflare/D1/OCR/공식 법원/변호사 승인이 아니다.
- 단일 인수 보드 [A3-IT-003](/), [A3-DOC-019](/), [A3-CALC-019](/), [A3-DATA-012](/), [A3-AX-006](/)은 **부분 증거만 보유 [ ] 유지**. 미등록·미승인 법률/서식 판단은 0% 합격.

## 6. 다음 시작

**다음 canonical #121 `business_registration::business_items`부터 #140까지**, 시작 역할 **변호사**. #101–120의 source-only·관측여부와 #113 수령일/금액 정합성을 기록하고, [PR #109](https://github.com/firmengine/firmengine/pull/109) / [PR #34](https://github.com/firmengine/firmengine/pull/34) 충돌·native Node 회귀·실무자 승인/법원증빙 근거 확인이 필요. 제품 전체 인수 [x] 0건; 운영 배포, D1 운영 migration, 전자제출, 법원 인가 확정 **미실행**.
