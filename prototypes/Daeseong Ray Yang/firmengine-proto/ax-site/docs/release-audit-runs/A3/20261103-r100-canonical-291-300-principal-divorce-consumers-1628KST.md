# FirmEngine A3 r100 — canonical #291–300 증거·계산·법률·양식 소비처 감사

- 실행 시점: 2026-11-03 16:28 KST. 기준 `main` HEAD: `c26f6360b946284db44c5aaa54a98f13951ed350`, 인수 보드 blob: `4078efb3144bd375abf6d7f863fee1f8467772d3`. 허용 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 하위만.
- 직전 r99 #281–290 영수증과 r50 #281–300 선행 정적 조사, 최신 코드·테스트·GitHub 열린 PR #51/#63/#44를 조회한 뒤 이번 #291부터 다시 검사. 역할 순환: **계산사무장 → 변호사 → 데이터담당자 → AX담당자 → IT담당자 → 사용자·서류담당자**. 부분 확인 ID 5개: `A3-CALC-005`, `A3-LAW-007`, `A3-DATA-008`, `A3-AX-012`, `A3-DOC-015`; **모두 [ ] 미완료**. 다음 시작 역할: 변호사(상향 순환).
- 인수 계층: **원본 코드/선언 정적 확인 + 원본문 TypeScript 타입만 제거한 V8 격리 함수 17건**. `normalizeMoney`는 KRW 정수만 exact 처리하는 **합성 stub**. 다른 결합 함수·프로젝트 native Node 테스트/전체 CI·staging D1/R2/Cron·공식 법원 서식·변호사 승인·사이트 배포는 **실행·인수하지 않음**. 공개 Git에 고객 개인정보/원문 OCR 값/비공개 정답/키/env 없음. 운영 배포·마이그레이션·전자제출 미실행.

## 1. 구조 재조회 결과

```json
{
  "canonical": 693,
  "uniqueCanonical": 693,
  "documents": 85,
  "families": 48,
  "documentFamilyRoutes": 141,
  "slots": 1808,
  "duplicatedRouteFields": 0,
  "orphan": 0,
  "idsWithoutRoutes": 0,
  "selected": 10,
  "selectedSlots": 44,
  "registered": 2,
  "typed": 2,
  "directCalc": 0,
  "derived": 1,
  "material": 1,
  "forms": 1,
  "legal": 0,
  "calcModules": 18,
  "calcInputs": 91,
  "uniqueCalcInputs": 78,
  "risks": 95,
  "rules": 50,
  "exceptions": 46,
  "boardIds": 124,
  "tests": 17,
  "testsMatch": 17,
  "predicates": 10
}
```

- `lib/canonical-field-id-index.json` 693개를 **원본 순서대로 전체 순회**했고, 기본 `document-agent-field-contracts.json` 48 패밀리 + 85개 `shared-document-field-contracts.json` 문서 경로의 가족별 확장 + `ocr-field-supplements.json` 보강을 실 구현 `sharedDocumentFieldContract`의 병합 순서와 동일하게 독립 순회: 141 문서×family/1,808 선언 슬롯, 중복·고아·경로 없는 canonical 모두 0. 이는 추출 가능한 계약이지 원본 OCR 실측 건수가 아니다.
- #291–300 **10개 ID/44 선언 슬롯**, 채무증명서 family 2개×10문서, 이혼기록 가족 8개×3 family (이혼기록 문서 자체는 1종). `source_anchor`는 원본 문서 SHA·페이지·인용·bbox·행·대상자 식별을 **요구하도록 선언**됨; 실제 인용·페이지·복수행/주체·DB Fact·typed read-back = **미관찰**.
- 계산 18모듈/91선언 입력(고유 정규화 경로 78), 법률 위험 95·규칙 50·예외 46은 **카탈로그 구조/정확 문자열 계약 검색** 기준. 필드별 승인된 법률 필수피처 계약 0/10. 운영 기준정보의 동적 승인 여부는 미조회이므로 승인으로 추정하지 않는다.
- 정확 적용조건 등록 **2/10 (#291,#292)**, 미등록 **8/10 (#293~300, 승인 요건 0%)**. 직접 typed **2/10** (`debt.principal_balance`, `debt.total`), 직접 18계산 입력키 **0/10**, 파생 검토 후보 **#291→`debt.principal`/debt_total 1건**. `must_reconcile` **#291→debt.principal 1건**, 정확한 D5106 서식 token 선언 **#291 1건**, 법률 필수 승인 계약 0건. 직접 0이라도 삭제/비해당 취급하지 않는다.

## 2. 10개 ID별 원천 및 소비처/공백 (선언 수준)

| 번호 | canonical | 문서×family 선언 연결 | 타입 / 단위 / 시간 / 주체 | 적용조건 | typed / source-only | 18계산 입력 | material 게이트 | form token 후보 | 법률 승인 계약 |
|---|---|---|---|---|---|---|---|---|---|
| #291 | `debt_certificate::principal_balance` | 10 (debt_certificate, creditor_request_copy, loan_contract, card_statement, private_loan_transfer, mortgage_balance, loan_use_of_funds, vehicle_lease_contract, prior_creditor_list, private_adjustment_records) / debt_certificate | money; currency and exact source unit if monetary; not_applicable; debtor | 등록·승인전 | `debt.principal_balance` | 직접 0 / derived debt_total | must_reconcile → debt.principal | D5106.creditor.principal | 0 |
| #292 | `debt_certificate::total_claim` | 10 (debt_certificate, creditor_request_copy, loan_contract, card_statement, private_loan_transfer, mortgage_balance, loan_use_of_funds, vehicle_lease_contract, prior_creditor_list, private_adjustment_records) / debt_certificate | money; currency and exact source unit if monetary; not_applicable; debtor | 등록·승인전 | `debt.total` | 직접 0 | 0 | 0 | 0 |
| #293 | `divorce_records::actual_support_paid` | 3 (divorce_records) / asset_transfer_disposition, identity_residence_record, household_composition_support | money; source currency/unit; not_applicable; document_subject | **미등록=0%** | source-only | 직접 0 | 0 | 0 | 0 |
| #294 | `divorce_records::agreement_or_order_date` | 3 (divorce_records) / asset_transfer_disposition, identity_residence_record, household_composition_support | date; not_applicable; source_date_time_or_period; document_subject | **미등록=0%** | source-only | 직접 0 | 0 | 0 | 0 |
| #295 | `divorce_records::divorce_date` | 3 (divorce_records) / asset_transfer_disposition, identity_residence_record, household_composition_support | date; not_applicable; source_date_time_or_period; document_subject | **미등록=0%** | source-only | 직접 0 | 0 | 0 | 0 |
| #296 | `divorce_records::former_spouse` | 3 (divorce_records) / asset_transfer_disposition, identity_residence_record, household_composition_support | party_role; not_applicable; not_applicable; document_subject | **미등록=0%** | source-only | 직접 0 | 0 | 0 | 0 |
| #297 | `divorce_records::marriage_date` | 3 (divorce_records) / asset_transfer_disposition, identity_residence_record, household_composition_support | date; not_applicable; source_date_time_or_period; document_subject | **미등록=0%** | source-only | 직접 0 | 0 | 0 | 0 |
| #298 | `divorce_records::partition_amount` | 3 (divorce_records) / asset_transfer_disposition, identity_residence_record, household_composition_support | money; source currency/unit; not_applicable; document_subject | **미등록=0%** | source-only | 직접 0 | 0 | 0 | 0 |
| #299 | `divorce_records::partition_asset` | 3 (divorce_records) / asset_transfer_disposition, identity_residence_record, household_composition_support | identifier; not_applicable; not_applicable; document_subject | **미등록=0%** | source-only | 직접 0 | 0 | 0 | 0 |
| #300 | `divorce_records::support_child` | 3 (divorce_records) / asset_transfer_disposition, identity_residence_record, household_composition_support | party_role; not_applicable; not_applicable; document_subject | **미등록=0%** | source-only | 직접 0 | 0 | 0 | 0 |

- `extracted_features.canonical_field_id,raw_value_json,unit,source_state,quote,bbox_json,record_id,ordinal` 경로는 `db/schema.ts`, `extraction-row-store.ts`에서 선언·저장 구현 코드 존재만 확인. 진짜 D1 row insert/read, 시점별 Fact 유효성, 체결·양도·이혼 당사자 일치, 행간 cross-record borrowing 배제는 이 회차 실 DB 테스트 0건. `null`/명시적 `0`/`explicit_none`/미관찰/충돌/검토전의 의미 분리 유지.
- `form-mapping.ts`에서 D5106 원금은 `debt.principal_balance` 또는 `debt.outstanding_principal`의 검토된 Fact 경로가 후보이고, `OCR_DECLARED_FORM_TARGETS`에는 #291 `D5106.creditor.principal`이 선언되어 있음. **선언된 토큰/모듈 연결 ≠ 채무원금 확정 ≠ 공식 Word/전자양식 출력 합격**.
- `preapproval-correction-item-store.ts`의 `requiredCanonicalFieldIds`는 사람과 실제 법원 보정문서·사건 revision이 결속될 때 쓰이는 **수동 요청 경로**이며, 이 10개에 대한 자동·법률 승인 소비를 입증하지 않음. 갈음/대체증빙 허용·법원 제출 인정/사건별 적격성은 별도 실무 검토 미인증.

## 3. 원본 OCR 셀 함수 합성 실행: 실제 입력 / 독립 현행분기 기대 / 관찰

- 방법: `lib/ocr-calculation-input.ts`의 `validDate`, `validTime`, `calculationSourceCellIssues` **실제 함수 본문을 그대로 가져와 TypeScript 타입 표기만 제거**하고 V8에서 평가. 금액 정규화 의존성은 **합성 KRW 정수 stub**이므로 실제 `domain.normalizeMoney` E2E는 미검증.
- **17/17 관찰이 예측된 현재 로컬 분기와 일치**. 안전성 독립 기준으로는 quote 통화와 unit 충돌 3조건, 임의 당사자/자산/자녀 식별 3조건이 **로컬 오류 없이 통과**함. 이는 로컬 함수 검증 공백이지 상위 전체 제품 결함의 최종 입증은 아니다.

| 피처·합성 시나리오 | 원본 함수에 준 입력 | 현재 분기 독립 기대 이슈 | 실제 반환 이슈 | 판정과 업무상 위험 |
|---|---|---|---|---|
| #291 valid principal | `12000000` · unit=`KRW` · quote=`12000000원` · present/clear | `[]` | `[]` | 현재 함수 일치; positive |
| #291 currency conflict | `12000000` · unit=`KRW` · quote=`USD 12000000` · present/clear | `[]` | `[]` | 현재 함수 일치; P2 cross-field gap |
| #291 present but null | `—` · unit=`KRW` · quote=`—` · present/clear | `SOURCE_PRESENT_VALUE_MISSING` | `SOURCE_PRESENT_VALUE_MISSING` | 현재 함수 일치; expected |
| #292 zero present | `0` · unit=`KRW` · quote=`총청구액 0원` · present/clear | `[]` | `[]` | 현재 함수 일치; zero preserved |
| #292 explicit_none | `—` · unit=`—` · quote=`—` · explicit_none/clear | `[]` | `[]` | 현재 함수 일치; not a zero |
| #292 foreign unit | `100` · unit=`USD` · quote=`100 USD` · present/clear | `SOURCE_MONEY_NOT_EXACT_KRW` | `SOURCE_MONEY_NOT_EXACT_KRW` | 현재 함수 일치; expected |
| #293 actual support paid | `500000` · unit=`KRW` · quote=`실지급 500000원` · present/clear | `[]` | `[]` | 현재 함수 일치; source-only |
| #293 currency conflict | `500000` · unit=`KRW` · quote=`USD 500000` · present/clear | `[]` | `[]` | 현재 함수 일치; P2 cross-field gap |
| #294 invalid decision date | `2026-02-30` · unit=`—` · quote=`결정 2026-02-30` · present/clear | `SOURCE_DATE_INVALID` | `SOURCE_DATE_INVALID` | 현재 함수 일치; expected |
| #295 valid divorce date | `2026-03-01` · unit=`—` · quote=`이혼 2026-03-01` · present/clear | `[]` | `[]` | 현재 함수 일치; expected |
| #296 unknown former spouse token | `???` · unit=`—` · quote=`???` · present/clear | `[]` | `[]` | 현재 함수 일치; P2 no party semantics |
| #297 invalid marriage date | `2026-02-30` · unit=`—` · quote=`혼인 2026-02-30` · present/clear | `SOURCE_DATE_INVALID` | `SOURCE_DATE_INVALID` | 현재 함수 일치; expected |
| #298 currency conflict | `200000` · unit=`KRW` · quote=`USD 200000` · present/clear | `[]` | `[]` | 현재 함수 일치; P2 cross-field gap |
| #299 unbound partition asset | `???` · unit=`—` · quote=`???` · present/clear | `[]` | `[]` | 현재 함수 일치; P2 no reference semantics |
| #300 unbound support child | `???` · unit=`—` · quote=`???` · present/clear | `[]` | `[]` | 현재 함수 일치; P2 no subject semantics |
| #291 missing quote | `12000000` · unit=`KRW` · quote=`—` · present/clear | `SOURCE_QUOTE_MISSING` | `SOURCE_QUOTE_MISSING` | 현재 함수 일치; expected |
| #298 uncertain reading | `200000` · unit=`KRW` · quote=`200000원` · present/uncertain | `SOURCE_READ_UNCERTAIN` | `SOURCE_READ_UNCERTAIN` | 현재 함수 일치; expected |

- `feature-lineage-audit.ts` 원본 `hasPeriod`/ `hasUnit` 술어 각 10회 총 20회 격리 실행. **기간 true 3/10 (#294,#295,#297), 단위 true 4/10 (#291,#292,#293,#298)**. 이 10개는 개별 `temporal_role`과 로컬 기간분기 불일치 0건(문서 전체 기간 필요성은 별개). 로컬 날짜 형식 유효성은 혼인/이혼 효력 확정이 아니다.

## 4. 독립 업무상 미통과/고위험 확인 필요

1. **#291 현재 원금 ≠ 최초 원금 #288 ≠ 총청구액 #292.** #291은 typed·material 검산·D5106 코드 후보 경로가 있지만 `debt.principal` 경로는 검토 파생입력이며 원천 금액 자동 승격/중복 합산 금지. #292 총청구액에는 미수이자 #285, 연체이자 #290, 비용 #284가 포함되는지 원청구 문서 내 구성항목·기준일 검산 필수. 금액을 임의 산식으로 확정하거나 불일치 값을 0으로 처리 금지.
2. **#293 실지급 양육비 ≠ 명목 약정 양육비**, #294 합의/결정일 ≠ #295 이혼일 ≠ #297 혼인일. 법원 효력일·당사자·실제 지급 입증과 부양여부는 법률/서류 담당자 별도 승인 사항. #296 전 배우자, #300 자녀, #299 분할 자산 식별은 같은 문서/행에 등장했다고 동일인/동일재산이 자동 확인되는 것은 아님.
3. **#298 재산분할 금액은 현재 귀속 자산의 청산가치나 현금 수취와 동일하지 않음.** 제3자 명의/권리 귀속, 이미 반영된 거래·자산 Fact와의 중복을 막아야 함. 원통화 USD 인용인데 입력단위 KRW인 합성 시나리오를 로컬 함수는 검출하지 못함. 원통화·기간·지급자·수령자와 문서/페이지/행 식별 검산 필요.
4. **#293~300 정확 적용조건 미등록 8건 = 해당 요건 개별 0%**. OCR 원천/source-only는 삭제/자동 none/0/비해당 하지 않고 증거·검산·역질문·추가 증빙·법적 근거 검토 후보로 보존. 미인증 원문/실 D1/법원 양식/변호사 검토는 모두 **미관찰**.
5. 코드의 원본 `hasPeriod`/통화/party-ref 로컬 단계는 전체 승인 체인의 일부일 뿐. 상위 API 또는 SQL 저장 단계 검사가 통과/실패하는지는 이 회차 재현하지 못함. 기존 열린 Draft PR #51(기간), #63(채무 Fact), #44(금액 원천 정합성)와 충돌·법률 의미 변경 위험으로 이 회차 제품 코드 변경 안 함; 수정 필요성은 사람 검토/별도 Draft PR 후보.

## 5. 회차 검증 등급·인수 경계

| 검증층 | 결과 |
|---|---|
| 정확 최신 canonical/서류-family/소비처 선언 조회 | 수행·구조 불변식 확인 |
| 원본 함수 V8 분기 테스트 | 17/17 **현행 동작 재현**, 업무 안전 승인 아님 |
| 기간·단위 원본 술어 | 20회 실행, 기간3·단위4 |
| 실 고객 원문/OCR 페이지·복수행·quote·bbox 검증 | **미관찰** |
| SQL D1 Fact 저장/조회·typed CaseData 실제 투입 | **미실행** |
| 18계산·91입력 전체 실행/Node 통합 CI | **미실행** |
| 95 위험/50 규칙/46 예외의 운영 승인·법률효력 | **미승인/미조회: 0%** |
| 공식 법원 서식/갈음·법원보정 E2E/변호사 승인 | **미실행/미승인** |
| 운영 배포/운영 D1 마이그레이션/전자제출 | **실행하지 않음** |
| A3 6담당자 체크 ID 인수 | **0/124, [ ] 유지** |

## 6. 다음 재감사 및 증빙

- **누적 순차 재감사 #300/693**, 다음 시작 **#301 `divorce_records::support_payer`**, 범위 #301–310. 다음 회차 변호사 역할 시작, #301–310의 이혼·부양비 증거 지급자/수령자·자녀·실제 납부 주체와 혼인/재산귀속 분리 검토. 최초 전체 canonical 정적 인덱스 조사 693/693과 현재 심층 순차 검사 300/693은 다른 수치이다.
- 본 회차는 **실행한 합성 시험/선언 조회만 통과 표시**, 중앙 보드 해당 5개 ID는 모두 [ ]를 유지한다. 이번 파일은 공개 가능한 합성 값·선언 ID/테스트 결과만 포함.
- 이전 r99: `docs/release-audit-runs/A3/20261103-r99-canonical-281-290-creditor-debt-evidence-1529KST.md`. 기존 r50: `docs/release-audit-runs/A3/20261101-r50-canonical-281-300-consumer-recheck.md`.

### 693개 canonical ID — 최신 인덱스 원본 순서 전수 열거

001. `account_garnishment::account_holder`
002. `account_garnishment::account_id`
003. `account_garnishment::court_or_authority`
004. `account_garnishment::creditor`
005. `account_garnishment::effective_date`
006. `account_garnishment::garnishment_amount`
007. `account_garnishment::issue_date`
008. `account_garnishment::released_amount`
009. `account_garnishment::seized_amount`
010. `account_garnishment::status`
011. `accounting_source::account_name`
012. `accounting_source::closing_balance`
013. `accounting_source::credits`
014. `accounting_source::debits`
015. `accounting_source::entity`
016. `accounting_source::issue_date`
017. `accounting_source::opening_balance`
018. `accounting_source::period_end`
019. `accounting_source::period_start`
020. `accounting_source::source_total`
021. `applicant_narrative_statement::identity.statement.admission_or_correction`
022. `applicant_narrative_statement::identity.statement.author`
023. `applicant_narrative_statement::identity.statement.event_end`
024. `applicant_narrative_statement::identity.statement.event_start`
025. `applicant_narrative_statement::identity.statement.narrative_text`
026. `applicant_narrative_statement::identity.statement.signature_status`
027. `applicant_narrative_statement::identity.statement.signed_at`
028. `applicant_narrative_statement::identity.statement.source_references`
029. `applicant_narrative_statement::identity.statement.statement_version`
030. `applicant_narrative_statement::identity.statement.topic`
031. `application_identity_venue::procedure.application.accepted_at`
032. `application_identity_venue::procedure.application.address`
033. `application_identity_venue::procedure.application.applicant_name`
034. `application_identity_venue::procedure.application.case_number`
035. `application_identity_venue::procedure.application.court`
036. `application_identity_venue::procedure.application.jurisdiction_exception`
037. `application_identity_venue::procedure.application.ordinary_venue_basis`
038. `application_identity_venue::procedure.application.phone_home`
039. `application_identity_venue::procedure.application.phone_mobile`
040. `application_identity_venue::procedure.application.phone_work`
041. `application_identity_venue::procedure.application.resident_id`
042. `application_identity_venue::procedure.application.ruleset_id`
043. `application_identity_venue::procedure.application.submitted_at`
044. `application_identity_venue::procedure.application.transition_rule`
045. `application_identity_venue::procedure.application_date`
046. `application_identity_venue::procedure.venue`
047. `asset_transfer_disposition::asset_id`
048. `asset_transfer_disposition::consideration`
049. `asset_transfer_disposition::market_value`
050. `asset_transfer_disposition::proceeds_received`
051. `asset_transfer_disposition::registration_date`
052. `asset_transfer_disposition::relationship`
053. `asset_transfer_disposition::review_status`
054. `asset_transfer_disposition::transaction_date`
055. `asset_transfer_disposition::transferee`
056. `asset_transfer_disposition::transferor`
057. `asset_transfer_disposition::use_of_proceeds`
058. `bank_account_balance::account_holder`
059. `bank_account_balance::account_id`
060. `bank_account_balance::account_status`
061. `bank_account_balance::balance`
062. `bank_account_balance::balance_as_of`
063. `bank_account_balance::currency`
064. `bank_account_balance::institution`
065. `bank_account_balance::issue_date`
066. `bank_transactions::account_id`
067. `bank_transactions::amount`
068. `bank_transactions::counterparty`
069. `bank_transactions::direction`
070. `bank_transactions::issue_date`
071. `bank_transactions::memo`
072. `bank_transactions::period_end`
073. `bank_transactions::period_start`
074. `bank_transactions::post_balance`
075. `bank_transactions::transaction_datetime`
076. `bank_transactions::transaction_id`
077. `bank_transactions::transaction_nature`
078. `business_asset_inventory::acquisition_date`
079. `business_asset_inventory::book_value`
080. `business_asset_inventory::condition`
081. `business_asset_inventory::disposal_restriction`
082. `business_asset_inventory::goodwill_contract`
083. `business_asset_inventory::market_value`
084. `business_asset_inventory::quantity`
085. `business_asset_inventory::quantity_unit`
086. `business_assets_liabilities::as_of_date`
087. `business_assets_liabilities::asset_or_claim_id`
088. `business_assets_liabilities::business_entity`
089. `business_assets_liabilities::gross_value`
090. `business_assets_liabilities::item_kind`
091. `business_assets_liabilities::ownership_interest`
092. `business_assets_liabilities::payable_amount`
093. `business_assets_liabilities::period_end`
094. `business_assets_liabilities::period_start`
095. `business_assets_liabilities::receivable_amount`
096. `business_assets_liabilities::secured_payoff`
097. `business_costs_and_ledgers::income.business_cost.accounting_basis`
098. `business_costs_and_ledgers::income.business_cost.business_continuity_flag`
099. `business_costs_and_ledgers::income.business_cost.business_entity`
100. `business_costs_and_ledgers::income.business_cost.expense_category`
101. `business_costs_and_ledgers::income.business_cost.gross_amount`
102. `business_costs_and_ledgers::income.business_cost.payment_date`
103. `business_costs_and_ledgers::income.business_cost.payment_status`
104. `business_costs_and_ledgers::income.business_cost.period_end`
105. `business_costs_and_ledgers::income.business_cost.period_start`
106. `business_costs_and_ledgers::income.business_cost.supplier`
107. `business_costs_and_ledgers::income.business_cost.tax_component`
108. `business_current_income_summary::income.self_employment.business_costs`
109. `business_current_income_summary::income.self_employment.contract_end`
110. `business_current_income_summary::income.self_employment.contract_id`
111. `business_current_income_summary::income.self_employment.gross_receivable`
112. `business_current_income_summary::income.self_employment.invoice_date`
113. `business_current_income_summary::income.self_employment.net_receipt`
114. `business_current_income_summary::income.self_employment.operator`
115. `business_current_income_summary::income.self_employment.payer_customer`
116. `business_current_income_summary::income.self_employment.service_period_end`
117. `business_current_income_summary::income.self_employment.service_period_start`
118. `business_current_income_summary::income.self_employment.withheld_tax`
119. `business_registration::business_entity`
120. `business_registration::business_id`
121. `business_registration::business_items`
122. `business_registration::business_type`
123. `business_registration::issue_date`
124. `business_registration::joint_operators`
125. `business_registration::opening_date`
126. `business_registration::registration_date`
127. `business_registration::representative`
128. `business_registration::status`
129. `business_sales_vat::income.sales.business_entity`
130. `business_sales_vat::income.sales.exempt_sales`
131. `business_sales_vat::income.sales.filing_date`
132. `business_sales_vat::income.sales.gross_sales`
133. `business_sales_vat::income.sales.issue_date`
134. `business_sales_vat::income.sales.reporting_period_end`
135. `business_sales_vat::income.sales.reporting_period_start`
136. `business_sales_vat::income.sales.returns_refunds`
137. `business_sales_vat::income.sales.sales_count`
138. `business_sales_vat::income.sales.taxable_sales`
139. `business_sales_vat::income.sales.vat_collected`
140. `card_statement::billed_amount`
141. `card_statement::billing_period`
142. `card_statement::card_product_kind`
143. `card_statement::installment_count`
144. `card_statement::merchant`
145. `card_statement::purchase_amount`
146. `card_statement::remaining_installments`
147. `cash_deposit_asset::actual_payoff`
148. `cash_deposit_asset::as_of_date`
149. `cash_deposit_asset::asset_id`
150. `cash_deposit_asset::asset_kind`
151. `cash_deposit_asset::encumbrance`
152. `cash_deposit_asset::gross_value`
153. `cash_deposit_asset::owner`
154. `cash_deposit_asset::ownership_share`
155. `cash_deposit_asset::protected_or_excluded_claim`
156. `cash_deposit_asset::valuation_basis`
157. `cash_holding_statement::acquisition_source`
158. `cash_holding_statement::cash_currency`
159. `cash_holding_statement::declaration_author`
160. `cash_holding_statement::declaration_date`
161. `cash_holding_statement::storage_location`
162. `conditional_case_specific_request::conditional.court_request.case_number`
163. `conditional_case_specific_request::conditional.court_request.court`
164. `conditional_case_specific_request::conditional.court_request.item_due`
165. `conditional_case_specific_request::conditional.court_request.legal_citation`
166. `conditional_case_specific_request::conditional.court_request.operative_text`
167. `conditional_case_specific_request::conditional.court_request.request_type`
168. `conditional_case_specific_request::conditional.court_request.response_deadline`
169. `conditional_case_specific_request::conditional.court_request.response_filed_at`
170. `conditional_case_specific_request::conditional.court_request.service_date`
171. `conditional_case_specific_request::conditional.court_request.status_change`
172. `conditional_education_childcare::conditional.education.billed_amount`
173. `conditional_education_childcare::conditional.education.enrollment_end`
174. `conditional_education_childcare::conditional.education.enrollment_start`
175. `conditional_education_childcare::conditional.education.fee_type`
176. `conditional_education_childcare::conditional.education.frequency`
177. `conditional_education_childcare::conditional.education.paid_amount`
178. `conditional_education_childcare::conditional.education.payer`
179. `conditional_education_childcare::conditional.education.provider`
180. `conditional_education_childcare::conditional.education.recipient`
181. `conditional_education_childcare::conditional.education.relation`
182. `conditional_education_childcare::conditional.education.subsidy`
183. `conditional_medical_expense::conditional.medical.applicant_relation`
184. `conditional_medical_expense::conditional.medical.billed_cost`
185. `conditional_medical_expense::conditional.medical.care_period_end`
186. `conditional_medical_expense::conditional.medical.care_period_start`
187. `conditional_medical_expense::conditional.medical.expected_recurring_cost`
188. `conditional_medical_expense::conditional.medical.medical_opinion_period`
189. `conditional_medical_expense::conditional.medical.paid_cost`
190. `conditional_medical_expense::conditional.medical.patient`
191. `conditional_medical_expense::conditional.medical.provider`
192. `conditional_medical_expense::conditional.medical.reimbursement`
193. `conditional_medical_expense::conditional.medical.service_date`
194. `conditional_medical_expense::conditional.medical.service_kind`
195. `conditional_nonstandard_income_or_household_event::conditional.change.affected_person`
196. `conditional_nonstandard_income_or_household_event::conditional.change.duration_end`
197. `conditional_nonstandard_income_or_household_event::conditional.change.effective_date`
198. `conditional_nonstandard_income_or_household_event::conditional.change.event_date`
199. `conditional_nonstandard_income_or_household_event::conditional.change.event_kind`
200. `conditional_nonstandard_income_or_household_event::conditional.change.expense_delta`
201. `conditional_nonstandard_income_or_household_event::conditional.change.income_delta`
202. `conditional_nonstandard_income_or_household_event::conditional.change.issuer`
203. `conditional_nonstandard_income_or_household_event::conditional.change.new_status`
204. `conditional_nonstandard_income_or_household_event::conditional.change.old_status`
205. `conditional_plan_funding_source::applicability.form.current_official_version`
206. `conditional_plan_funding_source::applicability.form.disposition_asset_ids`
207. `conditional_plan_funding_source::applicability.form.disposition_date`
208. `conditional_plan_funding_source::applicability.form.disposition_proceeds`
209. `conditional_plan_funding_source::applicability.form.income_source_evidence_ids`
210. `conditional_plan_funding_source::applicability.form.plan_source`
211. `conditional_plan_funding_source::applicability.form.proceeds_to_plan`
212. `conditional_plan_funding_source::applicability.form.review_status`
213. `conditional_plan_funding_source::applicability.form.selected_form_code`
214. `credit_information_report::assignment_event_date`
215. `credit_information_report::current_reported_creditor`
216. `credit_information_report::event_record_id`
217. `credit_information_report::issue_date`
218. `credit_information_report::previous_creditor`
219. `credit_information_report::report_as_of`
220. `credit_information_report::report_subject`
221. `credit_report::currency_unit`
222. `credit_report::event_date`
223. `credit_report::event_kind`
224. `credit_report::institution`
225. `credit_report::product_code`
226. `credit_report::reported_amount`
227. `credit_report::status`
228. `creditor_assignment_dispute::assignment_date`
229. `creditor_assignment_dispute::claim_id`
230. `creditor_assignment_dispute::claim_status`
231. `creditor_assignment_dispute::current_claimant`
232. `creditor_assignment_dispute::dispute_basis`
233. `creditor_assignment_dispute::disputed_amount`
234. `creditor_assignment_dispute::notice_date`
235. `creditor_assignment_dispute::prior_creditor`
236. `creditor_assignment_dispute::supporting_record`
237. `crypto_balance::account_owner`
238. `crypto_balance::asset_symbol`
239. `crypto_balance::available_quantity`
240. `crypto_balance::average_acquisition_price`
241. `crypto_balance::displayed_valuation`
242. `crypto_balance::exchange_or_wallet`
243. `crypto_balance::locked_quantity`
244. `crypto_balance::network`
245. `crypto_balance::total_quantity`
246. `crypto_balance::valuation_currency`
247. `crypto_balance::valuation_datetime`
248. `crypto_balance::valuation_unit_price`
249. `crypto_balance::wallet_address`
250. `crypto_transactions::asset_symbol`
251. `crypto_transactions::completed_at`
252. `crypto_transactions::counterparty_account_identity`
253. `crypto_transactions::crypto_event_kind`
254. `crypto_transactions::destination_address`
255. `crypto_transactions::fee_asset`
256. `crypto_transactions::fee_quantity`
257. `crypto_transactions::gross_trade_amount`
258. `crypto_transactions::network`
259. `crypto_transactions::quantity`
260. `crypto_transactions::quote_currency`
261. `crypto_transactions::requested_at`
262. `crypto_transactions::source_address`
263. `crypto_transactions::transfer_status`
264. `crypto_transactions::txid`
265. `crypto_transactions::unit_price`
266. `current_nonwage_income::income.other.contract_end`
267. `current_nonwage_income::income.other.deductions`
268. `current_nonwage_income::income.other.earning_period_end`
269. `current_nonwage_income::income.other.earning_period_start`
270. `current_nonwage_income::income.other.frequency`
271. `current_nonwage_income::income.other.gross_amount`
272. `current_nonwage_income::income.other.income_kind`
273. `current_nonwage_income::income.other.net_received`
274. `current_nonwage_income::income.other.payer`
275. `current_nonwage_income::income.other.payment_date`
276. `current_nonwage_income::income.other.recipient`
277. `debt_certificate::as_of_date`
278. `debt_certificate::claim_cause`
279. `debt_certificate::contract_id`
280. `debt_certificate::contract_interest_rate`
281. `debt_certificate::creditor`
282. `debt_certificate::creditor_address`
283. `debt_certificate::debtor`
284. `debt_certificate::fees`
285. `debt_certificate::interest_balance`
286. `debt_certificate::issue_date`
287. `debt_certificate::issuer`
288. `debt_certificate::original_principal`
289. `debt_certificate::origination_date`
290. `debt_certificate::overdue_interest`
291. `debt_certificate::principal_balance`
292. `debt_certificate::total_claim`
293. `divorce_records::actual_support_paid`
294. `divorce_records::agreement_or_order_date`
295. `divorce_records::divorce_date`
296. `divorce_records::former_spouse`
297. `divorce_records::marriage_date`
298. `divorce_records::partition_amount`
299. `divorce_records::partition_asset`
300. `divorce_records::support_child`
301. `divorce_records::support_payer`
302. `divorce_records::support_period`
303. `divorce_records::support_periodic_amount`
304. `divorce_records::support_recipient`
305. `employment_contract::employer_signature_date`
306. `employment_contract::employer_signature_status`
307. `employment_history::insurance_scheme`
308. `employment_history::qualification_acquired`
309. `employment_history::qualification_lost`
310. `employment_history::qualification_record_scope`
311. `employment_history::qualification_type`
312. `employment_history::qualification_workplace`
313. `employment_relationship::income.employment.allowance_terms`
314. `employment_relationship::income.employment.base_wage`
315. `employment_relationship::income.employment.contract_term`
316. `employment_relationship::income.employment.employee`
317. `employment_relationship::income.employment.employer`
318. `employment_relationship::income.employment.employment_type`
319. `employment_relationship::income.employment.end_date`
320. `employment_relationship::income.employment.hours`
321. `employment_relationship::income.employment.issue_date`
322. `employment_relationship::income.employment.start_date`
323. `guarantee_joint_claim::applicant_role`
324. `guarantee_joint_claim::creditor`
325. `guarantee_joint_claim::dispute_status`
326. `guarantee_joint_claim::guarantee_claimed`
327. `guarantee_joint_claim::guarantee_limit`
328. `guarantee_joint_claim::principal_debtor`
329. `guarantee_joint_claim::recourse_status`
330. `guarantee_joint_claim::underlying_claim_id`
331. `health_insurance_arrears::as_of_date`
332. `health_insurance_arrears::authority`
333. `health_insurance_arrears::disposal_cost`
334. `health_insurance_arrears::issue_date`
335. `health_insurance_arrears::late_charge`
336. `health_insurance_arrears::period_end`
337. `health_insurance_arrears::period_start`
338. `health_insurance_arrears::subscriber`
339. `health_insurance_arrears::total_arrear`
340. `health_insurance_arrears::unpaid_contribution`
341. `household_composition_support::household.support.member`
342. `household_composition_support::household.support.other_income`
343. `household_composition_support::household.support.relationship`
344. `household_composition_support::household.support.residence_end`
345. `household_composition_support::household.support.residence_start`
346. `household_composition_support::household.support.support_amount`
347. `household_composition_support::household.support.support_frequency`
348. `household_composition_support::household.support.support_period_end`
349. `household_composition_support::household.support.support_period_start`
350. `household_composition_support::household.support.support_provider`
351. `household_composition_support::household.support.support_recipient`
352. `household_living_expense::household.expense.arrears`
353. `household_living_expense::household.expense.beneficiary`
354. `household_living_expense::household.expense.billed_amount`
355. `household_living_expense::household.expense.billing_period_end`
356. `household_living_expense::household.expense.billing_period_start`
357. `household_living_expense::household.expense.expense_kind`
358. `household_living_expense::household.expense.issue_date`
359. `household_living_expense::household.expense.paid_amount`
360. `household_living_expense::household.expense.payer`
361. `household_living_expense::household.expense.provider`
362. `household_living_expense::household.expense.shared_allocation`
363. `identity_residence_record::identity.address`
364. `identity_residence_record::identity.household_members`
365. `identity_residence_record::identity.issue_date`
366. `identity_residence_record::identity.marital_status`
367. `identity_residence_record::identity.name`
368. `identity_residence_record::identity.record_number`
369. `identity_residence_record::identity.registration_id`
370. `identity_residence_record::identity.relationship`
371. `income_source_inventory::amount_basis`
372. `income_source_inventory::income_source_id`
373. `income_source_inventory::reported_expenses`
374. `income_source_inventory::reported_gross`
375. `income_source_inventory::reported_net`
376. `income_source_inventory::source_document_reference`
377. `income_source_inventory::source_kind`
378. `inheritance_records::attributed_amount`
379. `inheritance_records::decedent`
380. `inheritance_records::disclaimer_or_limited_acceptance`
381. `inheritance_records::filing_or_order_reference`
382. `inheritance_records::heir`
383. `inheritance_records::heir_relationship`
384. `inheritance_records::inherited_asset_id`
385. `inheritance_records::partition_agreement_date`
386. `inheritance_records::stated_share`
387. `inheritance_records::succession_opened_at`
388. `insurance_policy_asset::as_of_date`
389. `insurance_policy_asset::beneficiary`
390. `insurance_policy_asset::contract_holder`
391. `insurance_policy_asset::coverage_amount`
392. `insurance_policy_asset::end_date`
393. `insurance_policy_asset::insured`
394. `insurance_policy_asset::insurer`
395. `insurance_policy_asset::issue_date`
396. `insurance_policy_asset::pledge`
397. `insurance_policy_asset::policy_id`
398. `insurance_policy_asset::policy_loan_balance`
399. `insurance_policy_asset::policy_status`
400. `insurance_policy_asset::premium_per_payment`
401. `insurance_policy_asset::refund_net_basis`
402. `insurance_policy_asset::start_date`
403. `insurance_policy_asset::surrender_value`
404. `insurance_policy_asset::total_premium`
405. `lease_contract::fixed_date`
406. `lease_housing::applicant_relation`
407. `lease_housing::arrears_deduction`
408. `lease_housing::deposit`
409. `lease_housing::issue_date`
410. `lease_housing::landlord`
411. `lease_housing::monthly_rent`
412. `lease_housing::period_end`
413. `lease_housing::period_start`
414. `lease_housing::property_id`
415. `lease_housing::renewal_status`
416. `lease_housing::secured_balance`
417. `lease_housing::security_assignment`
418. `lease_housing::tenant`
419. `lease_housing::use`
420. `litigation_enforcement::case_id`
421. `litigation_enforcement::claim_type`
422. `litigation_enforcement::claimed_amount`
423. `litigation_enforcement::court_or_authority`
424. `litigation_enforcement::enforced_amount`
425. `litigation_enforcement::event_date`
426. `litigation_enforcement::issue_date`
427. `litigation_enforcement::judgment_amount`
428. `litigation_enforcement::parties`
429. `litigation_enforcement::security_or_attachment`
430. `litigation_enforcement::status`
431. `loan_contract::contract_interest_rate`
432. `loan_contract::maturity_date`
433. `loan_contract::repayment_installments`
434. `loan_contract::repayment_method`
435. `loan_contract::scheduled_payment`
436. `local_tax::arrears`
437. `local_tax::as_of_date`
438. `local_tax::assessed_amount`
439. `local_tax::authority`
440. `local_tax::collection_cost`
441. `local_tax::issue_date`
442. `local_tax::paid_amount`
443. `local_tax::surcharge`
444. `local_tax::tax_base`
445. `local_tax::tax_period`
446. `local_tax::tax_type`
447. `local_tax::taxpayer`
448. `local_tax_assessment::jurisdiction_scope`
449. `local_tax_assessment::no_assessment_text`
450. `local_tax_assessment::row_or_subtotal_kind`
451. `local_tax_assessment::tax_assessment_year`
452. `local_tax_assessment::tax_notice_status`
453. `local_tax_assessment::tax_object`
454. `payroll_payslip::income.payroll.allowances`
455. `payroll_payslip::income.payroll.bonus`
456. `payroll_payslip::income.payroll.employee`
457. `payroll_payslip::income.payroll.employer`
458. `payroll_payslip::income.payroll.gross_base`
459. `payroll_payslip::income.payroll.hours_days`
460. `payroll_payslip::income.payroll.issue_date`
461. `payroll_payslip::income.payroll.net_pay`
462. `payroll_payslip::income.payroll.other_deductions`
463. `payroll_payslip::income.payroll.overtime`
464. `payroll_payslip::income.payroll.pay_date`
465. `payroll_payslip::income.payroll.pay_period_end`
466. `payroll_payslip::income.payroll.pay_period_start`
467. `payroll_payslip::income.payroll.social_contributions`
468. `payroll_payslip::income.payroll.tax_withheld`
469. `pension_benefit_income::income.benefit.beneficiary`
470. `pension_benefit_income::income.benefit.benefit_type`
471. `pension_benefit_income::income.benefit.decision_date`
472. `pension_benefit_income::income.benefit.deductions`
473. `pension_benefit_income::income.benefit.monthly_gross`
474. `pension_benefit_income::income.benefit.net_payment`
475. `pension_benefit_income::income.benefit.payment_date`
476. `pension_benefit_income::income.benefit.payment_end`
477. `pension_benefit_income::income.benefit.payment_start`
478. `pension_benefit_income::income.benefit.provider`
479. `pension_benefit_income::income.benefit.review_status`
480. `pension_contribution_benefit::as_of_date`
481. `pension_contribution_benefit::benefit_amount`
482. `pension_contribution_benefit::benefit_type`
483. `pension_contribution_benefit::contribution`
484. `pension_contribution_benefit::encumbrance`
485. `pension_contribution_benefit::issue_date`
486. `pension_contribution_benefit::member`
487. `pension_contribution_benefit::payment_start`
488. `pension_contribution_benefit::period_end`
489. `pension_contribution_benefit::period_start`
490. `pension_contribution_benefit::plan_id`
491. `pension_contribution_benefit::provider`
492. `pension_contribution_benefit::vested_balance`
493. `pension_contribution_benefit::withdrawal_value`
494. `pension_contribution_statement::contribution_record_kind`
495. `pension_contribution_statement::paid_amount`
496. `pension_contribution_statement::paid_months`
497. `pension_contribution_statement::payable_amount`
498. `pension_contribution_statement::payable_months`
499. `pension_contribution_statement::standard_monthly_income`
500. `pension_contribution_statement::subscriber_type`
501. `pension_contribution_statement::unpaid_amount`
502. `pension_contribution_statement::unpaid_months`
503. `pension_contribution_statement::unpayable_amount`
504. `pension_contribution_statement::unpayable_months`
505. `procedure_court_orders::procedure.order.case_number`
506. `procedure_court_orders::procedure.order.court`
507. `procedure_court_orders::procedure.order.deadline`
508. `procedure_court_orders::procedure.order.debtor`
509. `procedure_court_orders::procedure.order.effective_date`
510. `procedure_court_orders::procedure.order.finality`
511. `procedure_court_orders::procedure.order.operative_text`
512. `procedure_court_orders::procedure.order.order_date`
513. `procedure_court_orders::procedure.order.order_type`
514. `procedure_court_orders::procedure.order.scope`
515. `procedure_court_orders::procedure.order.service_date`
516. `procedure_court_orders::procedure.order.status_change`
517. `procedure_enforcement_garnishment::procedure.enforcement.asset_or_income`
518. `procedure_enforcement_garnishment::procedure.enforcement.attached_amount`
519. `procedure_enforcement_garnishment::procedure.enforcement.authority`
520. `procedure_enforcement_garnishment::procedure.enforcement.case_number`
521. `procedure_enforcement_garnishment::procedure.enforcement.claimed_amount`
522. `procedure_enforcement_garnishment::procedure.enforcement.creditor`
523. `procedure_enforcement_garnishment::procedure.enforcement.debtor`
524. `procedure_enforcement_garnishment::procedure.enforcement.effective_date`
525. `procedure_enforcement_garnishment::procedure.enforcement.order_date`
526. `procedure_enforcement_garnishment::procedure.enforcement.order_type`
527. `procedure_enforcement_garnishment::procedure.enforcement.released_amount`
528. `procedure_enforcement_garnishment::procedure.enforcement.service_date`
529. `procedure_enforcement_garnishment::procedure.enforcement.status`
530. `procedure_prior_insolvency::procedure.history.case_number`
531. `procedure_prior_insolvency::procedure.history.case_type`
532. `procedure_prior_insolvency::procedure.history.court_authority`
533. `procedure_prior_insolvency::procedure.history.debtor`
534. `procedure_prior_insolvency::procedure.history.discharge_date`
535. `procedure_prior_insolvency::procedure.history.filing_date`
536. `procedure_prior_insolvency::procedure.history.finality_date`
537. `procedure_prior_insolvency::procedure.history.order_date`
538. `procedure_prior_insolvency::procedure.history.order_kind`
539. `procedure_prior_insolvency::procedure.history.private_adjustment_attempt`
540. `procedure_prior_insolvency::procedure.history.record_issue_date`
541. `procedure_private_creditor_request::procedure.creditor_info.as_of_date`
542. `procedure_private_creditor_request::procedure.creditor_info.claim_id`
543. `procedure_private_creditor_request::procedure.creditor_info.claim_origin_date`
544. `procedure_private_creditor_request::procedure.creditor_info.creditor`
545. `procedure_private_creditor_request::procedure.creditor_info.debtor`
546. `procedure_private_creditor_request::procedure.creditor_info.interest_balance`
547. `procedure_private_creditor_request::procedure.creditor_info.interest_rate`
548. `procedure_private_creditor_request::procedure.creditor_info.principal_balance`
549. `procedure_private_creditor_request::procedure.creditor_info.principal_original`
550. `procedure_private_creditor_request::procedure.creditor_info.request_copy`
551. `procedure_private_creditor_request::procedure.creditor_info.request_date`
552. `procedure_private_creditor_request::procedure.creditor_info.response_date`
553. `property_search::issue_date`
554. `property_search::jurisdiction_scope`
555. `property_search::ownership_share`
556. `property_search::property_found`
557. `property_search::property_id`
558. `property_search::registered_owner`
559. `property_search::search_as_of`
560. `property_search::searched_subject`
561. `real_estate_register::ownership_change_text`
562. `real_estate_register::property_address`
563. `real_property_register::acquisition_date`
564. `real_property_register::issue_date`
565. `real_property_register::maximum_claim`
566. `real_property_register::mortgage_holder`
567. `real_property_register::ownership_share`
568. `real_property_register::property_id`
569. `real_property_register::property_type`
570. `real_property_register::registered_owner`
571. `real_property_register::registered_value`
572. `real_property_register::registration_date`
573. `real_property_register::release_date`
574. `real_property_valuation::actual_payoff`
575. `real_property_valuation::disposal_cost`
576. `real_property_valuation::market_value`
577. `real_property_valuation::owner`
578. `real_property_valuation::ownership_share`
579. `real_property_valuation::property_id`
580. `real_property_valuation::valuation_date`
581. `real_property_valuation::valuation_method`
582. `receivable_collectability::collected_amount`
583. `receivable_collectability::collection_status`
584. `receivable_collectability::counterparty_status`
585. `receivable_collectability::demand_date`
586. `receivable_collectability::receivable_id`
587. `receivable_collectability::security_reference`
588. `receivable_collectability::uncollected_reason`
589. `resident_registration::address_change_date`
590. `resident_registration::historical_address`
591. `resident_registration::residence_history_period`
592. `retirement_estimate::estimated_retirement_date`
593. `retirement_estimate::payout_condition`
594. `retirement_estimate::retirement_scheme`
595. `retirement_estimate::service_period`
596. `retirement_estimate::transfer_history`
597. `salary_statement::employer_confirmation_status`
598. `salary_statement::employer_signature_date`
599. `salary_statement::gross_total`
600. `salary_statement::total_deductions`
601. `secured_claim_security::actual_payoff`
602. `secured_claim_security::collateral_id`
603. `secured_claim_security::discharge_date`
604. `secured_claim_security::grantor`
605. `secured_claim_security::priority`
606. `secured_claim_security::registered_maximum`
607. `secured_claim_security::registration_date`
608. `secured_claim_security::secured_party`
609. `secured_claim_security::security_type`
610. `securities_balance::account_coverage`
611. `securities_balance::asset_class`
612. `securities_balance::cash_balance`
613. `securities_balance::quantity`
614. `securities_balance::quantity_unit`
615. `securities_balance::security_id`
616. `securities_balance::security_name`
617. `securities_balance::settlement_basis`
618. `securities_balance::unsettled_liability`
619. `securities_balance::valuation_currency`
620. `securities_balance::valuation_datetime`
621. `securities_balance::valuation_method`
622. `securities_balance::valuation_unit_price`
623. `securities_transactions::counter_account`
624. `securities_transactions::fee`
625. `securities_transactions::quantity`
626. `securities_transactions::quantity_unit`
627. `securities_transactions::security_event_kind`
628. `securities_transactions::security_id`
629. `securities_transactions::security_name`
630. `securities_transactions::settled_amount`
631. `securities_transactions::settlement_date`
632. `securities_transactions::tax`
633. `securities_transactions::trade_gross`
634. `securities_transactions::trade_unit_price`
635. `tax_income::arrears`
636. `tax_income::gross_receipts`
637. `tax_income::income_after_expenses`
638. `tax_income::income_kind`
639. `tax_income::issue_date`
640. `tax_income::necessary_expenses`
641. `tax_income::period_end`
642. `tax_income::period_start`
643. `tax_income::tax_assessed`
644. `tax_income::tax_paid`
645. `tax_income::tax_year`
646. `tax_income::taxpayer`
647. `tax_public_arrear::as_of_date`
648. `tax_public_arrear::assessment_date`
649. `tax_public_arrear::authority`
650. `tax_public_arrear::costs`
651. `tax_public_arrear::debtor`
652. `tax_public_arrear::due_date`
653. `tax_public_arrear::issue_date`
654. `tax_public_arrear::principal_arrear`
655. `tax_public_arrear::surcharge_interest`
656. `tax_public_arrear::tax_period`
657. `tax_public_arrear::tax_type`
658. `tax_public_arrear::total_due`
659. `vehicle_registration::model_year`
660. `vehicle_registration::plate_number`
661. `vehicle_registration::record_issue_date`
662. `vehicle_registration::vin`
663. `vehicle_registry::acquisition_date`
664. `vehicle_registry::co_owners`
665. `vehicle_registry::lien_date`
666. `vehicle_registry::lien_holder`
667. `vehicle_registry::ownership_share`
668. `vehicle_registry::registered_lien_amount`
669. `vehicle_registry::registered_owner`
670. `vehicle_registry::registration_status`
671. `vehicle_registry::release_date`
672. `vehicle_registry::transfer_date`
673. `vehicle_registry::vehicle_id`
674. `vehicle_valuation::actual_payoff`
675. `vehicle_valuation::market_value`
676. `vehicle_valuation::mileage`
677. `vehicle_valuation::model_year`
678. `vehicle_valuation::owner`
679. `vehicle_valuation::registered_lien_amount`
680. `vehicle_valuation::valuation_date`
681. `vehicle_valuation::valuation_method`
682. `vehicle_valuation::vehicle_id`
683. `wage_withholding_tax::income.tax.employment_start_end`
684. `wage_withholding_tax::income.tax.gross_wages`
685. `wage_withholding_tax::income.tax.issue_date`
686. `wage_withholding_tax::income.tax.resident_tax`
687. `wage_withholding_tax::income.tax.tax_exempt_allowances`
688. `wage_withholding_tax::income.tax.tax_year`
689. `wage_withholding_tax::income.tax.taxable_allowances`
690. `wage_withholding_tax::income.tax.taxpayer`
691. `wage_withholding_tax::income.tax.withheld_income_tax`
692. `wage_withholding_tax::income.tax.withholding_agent`
693. `wage_withholding_tax::income.tax.year_end_adjustment`

### A3 6담당자 통합 보드 ID — 최신 보드 순서 전수 열거

1. `A3-IT-001`
2. `A3-IT-002`
3. `A3-IT-003`
4. `A3-IT-004`
5. `A3-IT-005`
6. `A3-IT-006`
7. `A3-IT-007`
8. `A3-IT-008`
9. `A3-IT-009`
10. `A3-IT-010`
11. `A3-IT-011`
12. `A3-IT-012`
13. `A3-IT-013`
14. `A3-IT-014`
15. `A3-IT-015`
16. `A3-IT-016`
17. `A3-IT-017`
18. `A3-IT-018`
19. `A3-IT-019`
20. `A3-IT-020`
21. `A3-DOC-001`
22. `A3-DOC-002`
23. `A3-DOC-003`
24. `A3-DOC-004`
25. `A3-DOC-005`
26. `A3-DOC-006`
27. `A3-DOC-007`
28. `A3-DOC-008`
29. `A3-DOC-009`
30. `A3-DOC-010`
31. `A3-DOC-011`
32. `A3-DOC-012`
33. `A3-DOC-013`
34. `A3-DOC-014`
35. `A3-DOC-015`
36. `A3-DOC-016`
37. `A3-DOC-017`
38. `A3-DOC-018`
39. `A3-DOC-019`
40. `A3-DOC-020`
41. `A3-CALC-001`
42. `A3-CALC-002`
43. `A3-CALC-003`
44. `A3-CALC-004`
45. `A3-CALC-005`
46. `A3-CALC-006`
47. `A3-CALC-007`
48. `A3-CALC-008`
49. `A3-CALC-009`
50. `A3-CALC-010`
51. `A3-CALC-011`
52. `A3-CALC-012`
53. `A3-CALC-013`
54. `A3-CALC-014`
55. `A3-CALC-015`
56. `A3-CALC-016`
57. `A3-CALC-017`
58. `A3-CALC-018`
59. `A3-CALC-019`
60. `A3-CALC-020`
61. `A3-LAW-001`
62. `A3-LAW-002`
63. `A3-LAW-003`
64. `A3-LAW-004`
65. `A3-LAW-005`
66. `A3-LAW-006`
67. `A3-LAW-007`
68. `A3-LAW-008`
69. `A3-LAW-009`
70. `A3-LAW-010`
71. `A3-LAW-011`
72. `A3-LAW-012`
73. `A3-LAW-013`
74. `A3-LAW-014`
75. `A3-LAW-015`
76. `A3-LAW-016`
77. `A3-LAW-017`
78. `A3-LAW-018`
79. `A3-LAW-019`
80. `A3-LAW-020`
81. `A3-LAW-021`
82. `A3-LAW-022`
83. `A3-DATA-001`
84. `A3-DATA-002`
85. `A3-DATA-003`
86. `A3-DATA-004`
87. `A3-DATA-005`
88. `A3-DATA-006`
89. `A3-DATA-007`
90. `A3-DATA-008`
91. `A3-DATA-009`
92. `A3-DATA-010`
93. `A3-DATA-011`
94. `A3-DATA-012`
95. `A3-DATA-013`
96. `A3-DATA-014`
97. `A3-DATA-015`
98. `A3-DATA-016`
99. `A3-DATA-017`
100. `A3-DATA-018`
101. `A3-DATA-019`
102. `A3-DATA-020`
103. `A3-DATA-021`
104. `A3-DATA-022`
105. `A3-AX-001`
106. `A3-AX-002`
107. `A3-AX-003`
108. `A3-AX-004`
109. `A3-AX-005`
110. `A3-AX-006`
111. `A3-AX-007`
112. `A3-AX-008`
113. `A3-AX-009`
114. `A3-AX-010`
115. `A3-AX-011`
116. `A3-AX-012`
117. `A3-AX-013`
118. `A3-AX-014`
119. `A3-AX-015`
120. `A3-AX-016`
121. `A3-AX-017`
122. `A3-AX-018`
123. `A3-AX-019`
124. `A3-AX-020`

### 이번 근거 GitHub blob SHA

- `lib/canonical-field-id-index.json` `27ecdddd208de82a2f5c675e7482485e3a8838c2`
- `lib/document-agent-field-contracts.json` `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`
- `lib/shared-document-field-contracts.json` `9decab974e0909ae24ad927bdfe241d75b71f3a9`
- `lib/ocr-field-supplements.json` `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`
- `lib/field-applicability-contracts.json` `6076b26f782c4643a21a7b2f1a8f6261bb588b68`
- `lib/reference-decision-tables.json` `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`
- `lib/risk-catalog.json` `e96dd0926e3ae9be5a5573d4551538ba294c4d2e`
- `lib/legal-catalog.json` `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`
- `lib/legal-exceptions.json` `6e51197226bfd8320e1147d8df3f12c11e00927c`
- `lib/ocr-calculation-input.ts` `8f7f51bf41f7c944b76419d7cc894e49ac771473`
- `lib/feature-lineage-audit.ts` `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`
- `lib/ocr-chain-matrix.ts` `977de86ba698bd805cc6b95d1384e3b49d0dbb4c`
- `lib/material-calculation-source-gate.ts` `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`
- `lib/canonical-field-binding.ts` `60ee5c7762d52b72a165b4f4f8214680eb98f148`
- `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` `4078efb3144bd375abf6d7f863fee1f8467772d3`
