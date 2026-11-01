# FirmEngine A3 r59 — canonical #461–480 소비처 심층 재감사 (2026-11-01 KST)

## 범위·기준
- 시작 GitHub `main` HEAD: `1d63858d7e7da64ac0f194bea486be3a363dd355`. 변경 허용 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래만. 직전 r58 #441–460과 최초 r24 #461–480 영수증을 이어 확인.
- 최신 `canonical-field-id-index.json` 원본 전체 순서를 조회하여 693개 고유 ID·중복 0을 확인. 문서/패밀리 원천 계약 전체 정적 조인: 85서류, 48 family, 141 routes, 1,808 slots, 고아 0. 이 회차는 아래 **20개 ID / 23 slots / 5문서 / 3 family**.
- 18개 계산 모듈/91 선언 입력, 법률위험95/법률규칙50/예외46, 내부 서식 토큰의 정확 ID 계약을 읽어 비교. 해당 20개 적용조건 등록 20/20, 위치·원천행 별도 기록 정책 23/23. 이는 값 검증·법률 승인 아님.
- 원본 typed/기간/금액 술어와 material gate 함수 본문을 V8 격리 실행했다. `hasPeriod` 23/23 true, `hasUnit` 8/23 true; material gate 합성 7/7 기대 일치. 전체 Node·CI/D1/R2/PDF·법률·공식서식 승인과 구별.

## 20개 ID별 원천·계산/법률/양식 소비처
모든 행은 원천 **조건 등록** 상태이다. 실제 PDF/DB Fact/법률인정은 관찰하지 않았다. `source-only`와 `-`는 0원/삭제/무용 판단이 아니다. 정확한 승인 법률 증거계약은 이 20개 모두 정적 0.
| # | canonical ID | 등록 서류/route | datatype/unit | 주체/시간역할 | typed | 18계산 입력후보 | material | 내부 form-token 후보 |
|---:|---|---|---|---|---|---|---|---|
| 461 | `payroll_payslip::income.payroll.net_pay` | salary_statement | money / KRW | applicant_debtor / period_scope | income.net | income_average:income.net | must_reconcile income.net | D5103.month.net_income / D5110.approved_monthly_income |
| 462 | `payroll_payslip::income.payroll.other_deductions` | salary_statement | money_or_itemized / KRW | applicant_debtor / period_scope | source-only | - | - | - |
| 463 | `payroll_payslip::income.payroll.overtime` | salary_statement | money / KRW | applicant_debtor / period_scope | source-only | - | - | - |
| 464 | `payroll_payslip::income.payroll.pay_date` | salary_statement | date / not_applicable | payee / event_date | source-only | - | - | - |
| 465 | `payroll_payslip::income.payroll.pay_period_end` | salary_statement | date / not_applicable | applicant_debtor / statement_period_end | income.period_end | income_average:income.periodEnd | - | - |
| 466 | `payroll_payslip::income.payroll.pay_period_start` | salary_statement | date / not_applicable | applicant_debtor / statement_period_start | income.period_start | income_average:income.periodStart | - | - |
| 467 | `payroll_payslip::income.payroll.social_contributions` | salary_statement | money / KRW | applicant_debtor / period_scope | source-only | - | - | - |
| 468 | `payroll_payslip::income.payroll.tax_withheld` | salary_statement | money / KRW | applicant_debtor / period_scope | source-only | - | - | - |
| 469 | `pension_benefit_income::income.benefit.beneficiary` | pension_certificate | party_role / not_applicable | applicant_debtor / not_applicable | source-only | - | - | - |
| 470 | `pension_benefit_income::income.benefit.benefit_type` | pension_certificate | enum_or_text / not_applicable | applicant_debtor / not_applicable | source-only | - | - | - |
| 471 | `pension_benefit_income::income.benefit.decision_date` | pension_certificate | date / not_applicable | authority / event_date | source-only | - | - | - |
| 472 | `pension_benefit_income::income.benefit.deductions` | pension_certificate | money_or_itemized / KRW | applicant_debtor / period_scope | source-only | - | - | - |
| 473 | `pension_benefit_income::income.benefit.monthly_gross` | pension_certificate | money / KRW | applicant_debtor / period_scope | source-only | - | - | - |
| 474 | `pension_benefit_income::income.benefit.net_payment` | pension_certificate | money / KRW | applicant_debtor / period_scope | source-only | - | must_reconcile income.net | - |
| 475 | `pension_benefit_income::income.benefit.payment_date` | pension_certificate | date / not_applicable | applicant_debtor / event_date | source-only | - | - | - |
| 476 | `pension_benefit_income::income.benefit.payment_end` | pension_certificate | date / not_applicable | applicant_debtor / effective_date | source-only | - | - | - |
| 477 | `pension_benefit_income::income.benefit.payment_start` | pension_certificate | date / not_applicable | applicant_debtor / effective_date | source-only | - | - | - |
| 478 | `pension_benefit_income::income.benefit.provider` | pension_certificate | party_role / not_applicable | authority / not_applicable | source-only | - | - | - |
| 479 | `pension_benefit_income::income.benefit.review_status` | pension_certificate | enum_or_text / not_applicable | applicant_debtor / record_as_of_date | source-only | - | - | - |
| 480 | `pension_contribution_benefit::as_of_date` | employment_history, pension_certificate, retirement_estimate, pension_contribution_statement (4 routes) | date / source date format normalized to ISO without loss | member / balance_as_of_date | source-only | - | - | - |

## 코드 소비처와 남은 공백
| 축 | 관찰 | 독립 기대·미검증 |
|---|---|---|
| 문서/원천 DB | `shared-document-catalog.ts`의 문서별 family 구별과 `db/schema.ts`의 `extraction_runs.source_hash/read_sha256`, `extraction_records.run_id/ordinal`, `extracted_features.canonical_field_id/raw_value_json/source_state/quote/bbox_json/projection_key`, `extraction_field_coverage` 보존 계약. | 실제 페이지·복수행/quote/bbox/원본 해시를 D1/R2에서 읽지 않음. #480은 4문서의 4 독립 선언 슬롯. 미관찰/null/0/해당없음/상충은 다름. |
| typed | #461 `income.net`, #465 `income.period_end`, #466 `income.period_start`만 직접 명시 **3/20**. 나머지 17개 source-only. | #462/467/468 공제·원천징수, #463 시간외수당은 #461 net에 무단 합산·중복 차감하지 않는다. 지급기간·주체·행 ID로 별도 대조한다. |
| 계산 | `income_average`의 정확 정규화 선언입력 3경로. `material-calculation-source-gate.ts`의 `must_reconcile` 2개: #461 및 #474. | **P2 재확인:** #474 연금 순지급은 `must_reconcile→income.net`인데 `pension_benefit_income` direct typed 0. 12개월 지속/수급자·원문/금액 검토 전 자동 인정 금지. 실 산식·DB E2E 0건. |
| 법률 | 위험95·규칙50·예외46의 이 20 ID **정확 승인 근거 계약 0**; `legal-evidence-criteria.ts` 기본 시드 `checks=[]`. `reviewScope()` income family의 KR-ACT-579/589/611·KR-RULE-79·SEOUL-402는 검토 후보일 뿐. | 관할·시행일·수급권·지속소득·법률상 인정·변호사 승인 0건. 운영 참조 DB 별도 승인 계약 미조회. 미승인 요건 **0% 합격**. |
| 서식 | #461의 `D5103.month.net_income`, `D5110.approved_monthly_income` 내부 후보 2개와 템플릿의 실제 suffix 토큰 2/2 정적 대조. 다른 19 ID 직접 토큰 0. | `eform-parity-matrix.json` 상태 `unverified`. OCR 원본 관찰≠공식 월소득 인정/실제 DOCX/법원전자양식 승인. |
| 갈음·보정 | 제출 서류 요구·갈음 승인·실제 보정명령의 별도 검토 계약 경로 확인. source-only 증거는 역질문·검산·법률입증을 위해 보존. | 대상 사건 B+C 갈음/철회·보정명령 기한/접수증/사람 승인/전자제출 실제 검증 0건. |

## 독립 기대·관찰 — 원본 함수 격리 시험
- `hasPeriod` 실제 결과는 23 routes 모두 true. 그러나 #469 수급자, #470 수급 종류, #478 지급기관은 개별 `temporal_role=not_applicable`인데 family 명칭 `pension_benefit_income`의 `income`으로 기간검사를 요구하는 **3개 P2 검토 후보**. 해당 판정 자체는 정적/원본 V8 재현; 법률상 필수 기간의 확정은 아님. PR #51의 세무과세연도 #451 후퇴 우려 때문에 전역 변경/병합 금지.
- `material-calculation-source-gate.ts`의 실제 함수 본문을 TS 타입 선언만 제거해 실행하고, 원문 Fact·moneyValue·sourceRefs는 **합성 mock**으로 주입했다. 아래 각 독립 기대와 관찰이 **7/7 일치**하며 실제 Node/CI/사건 E2E가 아니다.
| 합성 시나리오 | 독립 기대 | 격리 관찰 | 판정 |
|---|---|---|---|
| Pension present/no typed | `CALC_INPUT_UNCONNECTED_MATERIAL` | `CALC_INPUT_UNCONNECTED_MATERIAL` | 기대 일치 |
| Pension matched typed, unreviewed | `no issue; no legal recognition` | `no issue; no legal recognition` | 기대 일치 |
| Pension amount mismatch | `CALC_INPUT_AMOUNT_MISMATCH` | `CALC_INPUT_AMOUNT_MISMATCH` | 기대 일치 |
| Payroll same fact duplicated typed | `CALC_INPUT_MULTIPLE_TYPED_MATCHES` | `CALC_INPUT_MULTIPLE_TYPED_MATCHES` | 기대 일치 |
| Pension present/null | `CALC_INPUT_AMOUNT_INVALID` | `CALC_INPUT_AMOUNT_INVALID` | 기대 일치 |
| Pension explicit_none | `no issue; not inferred zero` | `no issue; not inferred zero` | 기대 일치 |
| Pension disputed | `CALC_INPUT_SOURCE_INVALID` | `CALC_INPUT_SOURCE_INVALID` | 기대 일치 |

- **중요:** `recognition=unreviewed`라도 동일 Fact/동일 금액 typed가 연결되면 material 정합성 오류가 0으로 나온다. 이 함수는 `automaticLegalRecognition=false`를 반환한다. material 대조 통과를 법률상 인정, 실제 월소득 산입 또는 법원서식 확정으로 승격하지 않는다.
- 기존 `tests/ocr-calculator-input-integration.test.ts`, `tests/feature-lineage-audit.test.ts`, `tests/material-calculation-source-gate.test.ts` 코드는 읽었으나 이번 최신 main의 Node 실행/CI는 미실행. 실제 고객 PDF, 원문 OCR 사실값, 키, .env, 비공개 정답 저장하지 않음.

## A3 중앙보드 5개 부분검증 (모두 `[ ]` 유지)
- DATA→IT→사용자·서류→계산사무장→변호사 역할 순환.
- `A3-DATA-004`: 20ID/23 route, typed3·계산입력 후보3, #474 필수대조 미연결. 실제 DB/원단위 계산 미검증.
- `A3-IT-017`: 17 source-only ID의 DB 원문/해시·행 보존 스키마 존재, 실제 재독 미검증.
- `A3-DOC-012`: 급여/연금 순액·공제·일자·지급자/수급자 대조와 대체서류·보정 요구, 실원문·담당자 승인 없음.
- `A3-CALC-001`: 두 종류 소득 net/gross/공제 중복검산 경계, material gate 7/7 격리, 실제 산식/사람 인정 미검증.
- `A3-LAW-001`: 95/50/46 정확 법률 증거계약 0/20, 관할/시행일·변호사 승인 미인증.

## 진행·정확한 검증 경계
- 순차 심층 재감사 **480/693 (69.3%)**, 남은 **213개**. 다음 **#481 `pension_contribution_benefit::benefit_amount`**, 범위 #481–500. 다음 역할 AX부터 순환.
- A3 체크 ID 총 **124개**, 완료 `[x]` **0개**. 제품 코드·운영 DB·배포·D1 운영 migration·전자제출·법원 인가 미실행.
- 전체 Node/CI, staging D1/R2/Cron, 공식 법원 서식/법률·세무 검토, 변호사 승인 모두 별도 **미인증**.
- 기준 blob: index `27ecdddd208de82a2f5c675e7482485e3a8838c2`, family `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`, binding `60ee5c7762d52b72a165b4f4f8214680eb98f148`, material `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`, lineage `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`.
