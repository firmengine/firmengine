# FirmEngine A3 r54 — canonical OCR #361–380 정확 소비처 심층 재감사 (2026-11-01 18:30 KST)

## 기준 판본·검증수준
- 작업 대상 `firmengine/firmengine:main` 의 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 독립 검사 고정 HEAD `3d1b0b8b131fac04cf1b1393e777de66fc03743e`, 작성 직전 HEAD `3d1b0b8b131fac04cf1b1393e777de66fc03743e`. 관련 source blob SHA 재조회 후 동일함을 확인.
- 직전 r53 #341–360, 최초 r19 #361–380, 중앙 단일 인수 보드, 최근 main/PR(특히 #51, #54, #63, #131)과 source/DB schema/테스트 계약 확인. 기존 결과를 최신 통합 합격으로 대체하지 않는다.
- 역할 순환: **AX담당자 → IT담당자 → 사용자·서류담당자 → 계산사무장 → 변호사**. 부분검증 ID: `A3-AX-020`, `A3-IT-007`, `A3-DOC-003`, `A3-CALC-004`, `A3-LAW-006`. **모두 `[ ]` 유지**. 다음 회차는 **데이터담당자**부터.
- 실제 수행 범위: GitHub 원본 JSON/TypeScript 정적 조인, 원본 `hasPeriod`/`hasUnit` 술어 74 원천 라우트 V8 실행, 직접 typed/정확 서식/실계산 경로/법률 정적 계약 확인. 실제 고객/OCR 원문·D1 저장행·R2 객체·Cron·전체 Node/CI·공식 서식 포털·변호사 승인·사이트 배포 **미관찰/미실행**.
- 공개 Git에 의뢰인 사실값/원본 OCR/개인식별값/키/`.env`/비공개 정답 0개 기록. `미관찰/null/0/비해당/상충/source-only/승인전` 구별. 산식·법률 의미 자동 변경 없음.

## 실행 입력→독립 기대→실제 관찰
| 독립 입력/검사 | 독립 기대 | 관찰 | 의미 |
|---|---|---|---|
| 최신 canonical index + 85 문서/48 base family + 확장·보강 join | 전체 고유 693 / source slot 1,808 / 중복·고아 0 | **693 / 85 / 48 / 1,808**, id 고아·충돌 0 | JSON 정적, 원문 검증 아님 |
| #361–380 index 순서 + 문서·패밀리 join | 20 고유 ID, 74 슬롯, 고유 서류 10종 | **20 / 74 / 10** (base 50 + extension 24) | 실제 원천 계약 |
| locator 정책·record 경계 | 출처 문서 hash/page/quote/bbox/행 식별 보존 선언 | **74/74** (base `source_locator_required` 50 + 확장 `required_source_anchor` 24); sourceOnly·noCrossRecordBorrowing 74/74 | 실제 document/page hash·행 증명 아님 |
| 정확 적용조건 `field-applicability-contracts.json` | 정확 ID별 등록/누락 구분 | **10/20 등록, 10/20 미등록** (#371–380) | 미등록 각각 0% 승인·자동 N/A 아님 |
| 정확 projection + `OCR_DECLARED_FORM_TARGETS` + 템플릿 token | 3 신원 typed, 3 내부 D5100 token, 계산 직접 0 | **typed 3, 내부 token 3, 직접 18계산/91입력 0** | 서식 실출력·전자소송 공식 parity 미인증 |
| material gate·위험95/규칙50/예외46·승인형 정책 seed | 이번 20 ID material 0, exact approved legal 0 | **0 / 95 / 50 / 46**, 88 risk 기본 필수피처 공백; 승인 seed `checks=[]` | 법률상 필요/합격 0% 미승인 |
| 원본 `hasPeriod(temporal_role, family)` ×74 | 시간 메타·family 문자열 기반 실제 반환 | **true 34/74**, `not_applicable`임에도 true **14 route** (#371–377의 각 2 family), **7 ID 혼재** | 전파 시 과잉 기간경고 후보, 법적 유효기간 정책 아님 |
| 원본 `hasUnit(datatype)` ×74 | type 단위 술어 실제 반환 | **true 15/74**, #362 `ratio_or_amount` true이나 canonical_unit=`not_applicable` | 비율/금전 단위 미분리 P2 검토 |
| 독립 assertions | 기준 ID/슬롯/카탈로그/소비처/기간·단위/법률 seed 등 35조건 | 첫 검사 **34/35**: 감사기에서 확장 24슬롯의 `source_locator_required`로 오조회; 원본 `required_source_anchor` 확인 후 **74/74, 총 35조건 충족** | 검사기 속성명 보정; 제품 코드 실패로 오기 금지 |

## 10개 문서 원천 라우트
- **H** household_living_expense · education_expense_evidence / free_residence_confirmation / household_expense_ledger / housing_expense_evidence / medical_expense_evidence (5)
- **I** identity_residence_record · divorce_records / family_relation / free_residence_confirmation / inheritance_records / resident_registration (5)
- **S** income_source_inventory · employment_relationship / current_nonwage_income / business_current_income_summary (3 routes under one document)
- **R** inheritance_records · asset_transfer_disposition (1)
- 10종 고유 문서, H/I에 `free_residence_confirmation` 중복. H=2 ID×5=10, I=8 ID×5=40, S=7 ID×3=21, R=3 ID×1=3; 합계 74 슬롯. 문서·페이지·복수행·발급주체·원통화·귀속기간·같은 사람/사업자·source SHA는 런타임 fact 대조 **미관찰**.

## #361–380 ID별 원천·증거·typed·계산·법률·양식 갭
`P/U`는 실제 원본 술어 반환 (Y/N; `N/Y`=가족 패밀리별 서로 다름). `sourceCondition` 존재는 원천 존재조건 등록이지 법률 승인 아님. `typed=없음`은 증거 폐기/법률 무용을 뜻하지 않음. 모든 행 exact material=0, exact 18계산 입력=0, exact 승인 법률증거=0이며 실사건 갈음·보정도 미관찰.
| # | canonical field | route/slots | type / original unit | 시간역할 / 대상 | sourceCondition 등록 | P/U | 직접 typed / 내부 form token |
|---:|---|---|---|---|---|:---:|---|
| 361 | `household_living_expense::household.expense.provider` | H/5 | `party_role` / `not_applicable` | `not_applicable` / `payee` | 등록 | N/N | source-only |
| 362 | `household_living_expense::household.expense.shared_allocation` | H/5 | `ratio_or_amount` / `not_applicable` | `period_scope` / `applicant_debtor` | 등록 | Y/Y | source-only |
| 363 | `identity_residence_record::identity.address` | I/5 | `address` / `not_applicable` | `record_as_of_date` / `applicant_debtor` | 등록 | Y/N | `person.address` · `D5100.address` |
| 364 | `identity_residence_record::identity.household_members` | I/5 | `party_list` / `not_applicable` | `not_applicable` / `household_member` | 등록 | N/N | source-only |
| 365 | `identity_residence_record::identity.issue_date` | I/5 | `date` / `not_applicable` | `document_issue_date` / `issuer` | 등록 | Y/N | source-only |
| 366 | `identity_residence_record::identity.marital_status` | I/5 | `enum` / `not_applicable` | `record_as_of_date` / `applicant_debtor` | 등록 | Y/N | source-only |
| 367 | `identity_residence_record::identity.name` | I/5 | `string` / `not_applicable` | `not_applicable` / `applicant_debtor` | 등록 | N/N | `person.name` · `D5100.client_name` |
| 368 | `identity_residence_record::identity.record_number` | I/5 | `string` / `not_applicable` | `not_applicable` / `issuer` | 등록 | N/N | source-only |
| 369 | `identity_residence_record::identity.registration_id` | I/5 | `masked_identifier` / `not_applicable` | `not_applicable` / `applicant_debtor` | 등록 | N/N | `person.resident_id_masked` · `D5100.resident_id` |
| 370 | `identity_residence_record::identity.relationship` | I/5 | `relationship_enum` / `not_applicable` | `not_applicable` / `household_member` | 등록 | N/N | source-only |
| 371 | `income_source_inventory::amount_basis` | S/3 | `category` / `not_applicable` | `not_applicable` / `document_subject` | **미등록(0%)** | N/Y/N | source-only |
| 372 | `income_source_inventory::income_source_id` | S/3 | `identifier` / `not_applicable` | `not_applicable` / `document_subject` | **미등록(0%)** | N/Y/N | source-only |
| 373 | `income_source_inventory::reported_expenses` | S/3 | `money` / `source currency/unit` | `not_applicable` / `document_subject` | **미등록(0%)** | N/Y/Y | source-only |
| 374 | `income_source_inventory::reported_gross` | S/3 | `money` / `source currency/unit` | `not_applicable` / `document_subject` | **미등록(0%)** | N/Y/Y | source-only |
| 375 | `income_source_inventory::reported_net` | S/3 | `money` / `source currency/unit` | `not_applicable` / `document_subject` | **미등록(0%)** | N/Y/Y | source-only |
| 376 | `income_source_inventory::source_document_reference` | S/3 | `id_list_or_text` / `not_applicable` | `not_applicable` / `document_subject` | **미등록(0%)** | N/Y/N | source-only |
| 377 | `income_source_inventory::source_kind` | S/3 | `category` / `not_applicable` | `not_applicable` / `document_subject` | **미등록(0%)** | N/Y/N | source-only |
| 378 | `inheritance_records::attributed_amount` | R/1 | `money` / `source currency/unit` | `not_applicable` / `document_subject` | **미등록(0%)** | N/Y | source-only |
| 379 | `inheritance_records::decedent` | R/1 | `party_role` / `not_applicable` | `not_applicable` / `document_subject` | **미등록(0%)** | N/N | source-only |
| 380 | `inheritance_records::disclaimer_or_limited_acceptance` | R/1 | `category` / `not_applicable` | `not_applicable` / `document_subject` | **미등록(0%)** | N/N | source-only |

## 소비처 코드·테스트와 공백
- **DB Fact/복수행**: `db/schema.ts`의 `document_instances`, `extraction_runs`, `extraction_records (runId/ordinal)`, `extracted_features (canonicalFieldId/rawValueJson/unit/sourceState/projectionKey/quote/bbox/ordinal)`, `extraction_field_coverage`와 `lib/extraction-row-store.ts`, `lib/field-observation.ts`의 원천 보존 경계 존재. 정적 선언이며 **이 74 슬롯의 실제 저장/재조회는 미실행**.
- **typed/18계산·91입력**: `lib/canonical-field-binding.ts`의 명시 매핑에서 #363 `person.address`, #367 `person.name`, #369 `person.resident_id_masked`만 직접 typed. `lib/reference-case-projection.ts`도 해당 신청인 매핑이 존재하나 실제 투영 실행/이중 인물 차단은 미인증. #371–377 세 패밀리 공용 source-only 관측은 `income.net/gross/expenses`로 자동 결산하지 않는다. `lib/material-calculation-source-gate.ts` 29 계약 내 이번 ID 직접 엔트리 0; 코드 선언 부재는 검산·역질문 가치 부재가 아니다.
- **서식**: `lib/ocr-chain-matrix.ts` exact #363→`D5100.address`, #367→`D5100.client_name`, #369→`D5100.resident_id`; `lib/template-token-catalog.json` 세 토큰 존재. `masked_identifier`는 마스킹 보존, 주민등록번호 원형 재구성 금지. 내부 토큰 선언≠현재 공식 e-form/실제 DOCX 승인. 다른 17개는 exact token 미선언.
- **법률**: 위험95/규칙50/예외46에서 이번 exact canonical 필수 증거계약 0, 기본 risk 88건 `required_features=[]`, `lib/legal-evidence-criteria.ts` 기본 seed `checks=[]`; 승인 기준정보의 운영판 미조회. `reviewScope()`의 D5100/D5103/D5105·D5110·KR/SEOUL 후보는 업무 검토 추천이지 공식/법률 필수 승인 아님. #378 상속 귀속금액, #379 피상속인, #380 포기/한정승인 판단은 법률효과 자동 확정 불가.
- **갈음/법원 보정**: `lib/case-requirement-field-plan.ts`, `lib/approve-document-substitution.ts`, `lib/preapproval-correction-item-store.ts` 코드상 ID·원천·사람검수 경로를 참고했으나 **#361–380의 실제 사건별 B+C 갈음, 법원 명령인용/접수증/서류대체, 생성 문서 연결 E2E=미관찰**. 비해당/null/0/실비/정산/상충 구분 유지.
- **기존 회귀 소스**: `tests/feature-lineage-audit.test.ts`, `tests/ocr-calculator-input-integration.test.ts`, `tests/household-multirow-ocr-integrity.test.ts`는 코드 열람. 이번 범위에서 전체 Node 테스트를 실행하거나 74 실제 D1 Fact를 공급하지 않음.

## 새/잔존 P2 판단·법률 경계 (제품 코드 미변경)
1. **적용조건 미등록 10 ID (#371–380)**: source_contract 존재와 법률 필요·승인은 별개. 담당자가 소득원/상속 원문 관찰 요건, 선택 서류, 원통화/기간·관할·시행일 및 철회 기준을 승인할 때까지 **각 0% 합격**, 삭제 또는 `not_applicable` 승격 금지.
2. **동일 ID/3패밀리의 기간 플래그 7건, 원본 함수 14 route 과잉 후보**: #371–377 모두 temporal `not_applicable`; `employment_relationship`은 false, `current_nonwage_income`와 `business_current_income_summary`는 true. 인원/소득원 ID/원문 참조에는 잘못된 기간 필수 메시지 위험. 하지만 #373–375 총액/경비/순액의 **실제 귀속기간** 검증은 필요. 기존 동일 함수의 Draft PR #51에서 법적 의미 변경 포함 가능, 중복 main 수정 금지.
3. **#362 비율·금액 단위 모호성**: `ratio_or_amount`, `canonical_unit=not_applicable`, 원본 `hasUnit=true`. 실제 분담비율/통화금액/기간/지급자 구분 없이 생계비·가용소득에 합산하지 않는다.
4. **#373–375 소득 금액 혼산 금지**: `reported_gross`−`reported_expenses`가 `reported_net`과 일치하는지 같은 원천/기간/사업자/통화/공제·세전/세후 의미 검산 후에만 검토; 중복 반영하거나 임의 KRW 환산 금지. #378 상속 금액은 소유권·지분·포기/한정승인 확인 전 자산 자동합산 금지.
5. **#363/367/369 개인정보·대상자**: 여러 서류의 신청인 vs 가족/상속인 발급명의 연결을 실데이터에서 검증하지 않았다. 3개 typed와 서식 토큰 선언이 존재해도 법률적으로 인정·전자제출 가능하다고 표기 금지.

## 중앙 보드에 반영할 5개 미완료 체크
| ID | 관찰된 부분 검증 | 남은 인수 |
|---|---|---|
| `A3-AX-020` | 미등록 적용조건 #371–380 10개·정확 계약 0% / source-only·사람 승인 상태 구분 | 관할·계약의 담당자 승인, 실제 프롬프트/툴 무승격 회귀 |
| `A3-IT-007` | 74 슬롯 단위/기간 원본 술어 검사; #362 ratio/unit 모호성, #371–377 패밀리별 14개 과잉 기간플래그 | source family별 검증 정책·Node/실원문 행·추출 E2E |
| `A3-DOC-003` | 신원/상속 문서 원천 10종·74슬롯 구분, 발급/관계/상속 법적 증거 역질문 확인 | 사건별 가족·상속 원본·갈음/법원보정·직원 실검수 |
| `A3-CALC-004` | #371–377 source inventory 7×3슬롯, 신고 총액/비용/순액 별도 보존; 계산 직접 0 | 기간/사업자·통화·중복 실증빙 및 18계산 입력 재실행 |
| `A3-LAW-006` | #378–380 원문 귀속·피상속인·포기/한정승인과 법률상 효력 분리, 승인 계약 0 | 공식 법령·관할·시행일·변호사 실제 검수 |

## 누적·다음 시작점
- 최초 canonical 정적 693/693. **심층 재감사 380/693, 잔여 313**. A3 전체 **124 체크 ID, 최종 완료 0**. V8 정적 계약 검증·소스 코드 존재와 Node/CI/staging D1·R2/Cron/공식 서식·변호사 승인/배포는 별도 상태.
- **다음 #381 `inheritance_records::filing_or_order_reference` ~ #400**; **데이터담당자**부터 순환. 운영 배포·D1 운영 마이그레이션·전자제출·법원 인가 확정 **미실행**.

## 확인한 기준 blob SHA (전부 동일 main source)
- `lib/canonical-field-id-index.json` = `27ecdddd208de82a2f5c675e7482485e3a8838c2`
- `lib/document-agent-field-contracts.json` = `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`
- `lib/shared-document-field-contracts.json` = `9decab974e0909ae24ad927bdfe241d75b71f3a9`
- `lib/ocr-field-supplements.json` = `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`
- `lib/field-applicability-contracts.json` = `6076b26f782c4643a21a7b2f1a8f6261bb588b68`
- `lib/feature-lineage-audit.ts` = `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`
- `lib/canonical-field-binding.ts` = `60ee5c7762d52b72a165b4f4f8214680eb98f148`
- `lib/ocr-chain-matrix.ts` = `977de86ba698bd805cc6b95d1384e3b49d0dbb4c`
