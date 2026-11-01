# FirmEngine A3 r68 — canonical OCR #641–660 증거·계산·법률·서식 소비처 독립 재감사

- 감사 시점: **2026-11-02 08:27 KST**; 읽은 GitHub `main` 기준 HEAD: `92aba536623fffc29e229be430b122d2392669ec`. 원본 GitHub 파일 blob 및 지난 r33/r67 영수증, 중앙 보드 A3 체크 ID를 확인. 이 영수증은 **코드/스키마/격리 함수**의 결과이며 운영 환경의 검증 영수증이 아님.
- 범위: **정확히** `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부. 대상 canonical 순번 **641–660** (20 ID). 역할 순환: **데이터 → IT → 사용자·서류 → 계산사무장 → 변호사**. 다음 시작 역할 **AX**. 이전 심층 재감사 r67 #621–640 이후 진행.
- canonical 인덱스 전체 **693개 고유, 정렬 순서 유지, 중복 0**; 85 서류/48 패밀리; 전체 서류×패밀리 원천 필드 라우트 **1,808 슬롯**. 전체 원본 인덱스 #1–693을 이 문서 맨 아래에 **번호 그대로 전부 나열**; 이 목록은 구현상 유효성/운영 승인 목록이 아님.
- 이번 20 ID는 5서류, **44개 원천 슬롯**, 슬롯별 `recordPolicy.noCrossRecordBorrowing=true` **44/44**, 페이지·해시·행·인용/BBox/대상/기간 구별은 **계약 선언만 검토**. 실제 OCR 문서·페이지 이미지·D1 Fact 저장값/복수행 readback은 **미관찰**. 18개 계산 모듈/91개 선언 입력은 `calculation-input-audit.ts`의 경로 계약과 이전 감사 카탈로그를 참조했으며 **전체 입력 소비 실행 미인증**.
- 적용조건 exact 등록 **18/20**, **#659/#660 미등록 2 → 해당 적용조건 승인 검증 0%**. direct typed projection **2/20 (#641/#642: `income.period_end/start`)**, 29개 material 정책 중 **2/20 (#654→`debt.principal`, #655→`debt.interest`, `must_reconcile`)**; 양쪽 미연결 **16개**는 source-only로 유지. direct OCR→공식 서식 token **0/20**, 95 위험/50 법률 규칙/46 예외의 **exact canonical ID 정적 리터럴 근거계약 0/20**. 동적 실무자 승인 정책·법원 서식·전자제출은 **미조회/미인증**. `reviewScope()` D510x/법조문은 **검토 후보**이지 승인 증거계약이 아님.

## 독립 범위·계약 확인

| 불변식/조건 | 독립 기대 | 관찰 | 판정 수준 |
|---|---:|---:|---|
| 전체 canonical ID 고유·사전식 정렬 | 693 / 고유 693 / 정렬 | 693 / 693 / true | 정적 인덱스 일치 |
| 서류/패밀리/원천 라우트 | 85 / 48 / 1,808 | 85 / 48 / 1,808 | 정적 선언 수량 일치 |
| 이 회차 정확 ID 및 원천 슬롯 | 20 / 44 | 20 / 44 | 정적 조인 일치 |
| 원천행 분리 정책 | 44/44 | 44/44 | 선언 일치 (실행 아님) |
| 적용조건 exact ID 등록 | **20 필요** | **18, 미등록 2** | **미완료; 누락 승인 0%** |
| direct typed / material must | 별도 확인 | 2 / 2 | 선언 확인, 계산 E2E 미실행 |
| 정확 서식 토큰·승인 법률 증거계약 | 법원·실무자 확인 필요 | 정적 exact 0 / 0 | 승인 미인증·0% |
| 운영 OCR·D1/R2/Cron·Node CI | 실행증거 필요 | 미실행/미관찰 | **합격 판정 불가** |

## 20개 ID 원천·시간·단위·대상·DB Fact/typed·계산·서식/법률 소비처

약어: I=`income_amount_certificate`, T=`tax_arrears`, N=`national_tax_arrears_fact`, S=`social_insurance_arrears`, V=`vehicle_registration`. P/U/A는 원본 `hasPeriod`/`hasUnit` V8 술어 / 정확 적용조건 선언(1/0). **P/U는 실제 법적 기간·금액의 적격성 검사 결과가 아니다.** DB는 `extraction_records`→`extracted_features`(`raw_value_json`, `canonical_field_id`, `source_state`)→`extraction_field_coverage`의 정적 계약; 원문·페이지·record ordinal·단위·subject는 실제 읽지 않았음. 모든 44 경로는 해당 서류 `recordPolicy` 및 `required_source_anchor`의 해시/페이지/행/quote/bbox를 요구.

| # | canonical ID | 서류@패밀리 | 자료형; 단위; 시간역할; 대상 | slots; P/U/A | 직접 소비처·정책 | exact form / static legal |
|---:|---|---|---|---|---|---|
| 641 | `tax_income::period_end` | I@tax_income | date; 원문 날짜→ISO; statement_period_end; taxpayer | 1; 1/0/1 | typed `income.period_end` | 0 / 0 |
| 642 | `tax_income::period_start` | I@tax_income | date; 원문 날짜→ISO; statement_period_start; taxpayer | 1; 1/0/1 | typed `income.period_start` | 0 / 0 |
| 643 | `tax_income::tax_assessed` | I@tax_income | money; 원문 통화·단위; not_applicable; taxpayer | 1; 1/1/1 | source-only (증거·검산·역질문) | 0 / 0 |
| 644 | `tax_income::tax_paid` | I@tax_income | money; 원문 통화·단위; not_applicable; taxpayer | 1; 1/1/1 | source-only (증거·검산·역질문) | 0 / 0 |
| 645 | `tax_income::tax_year` | I@tax_income | year; —; tax_period_year; taxpayer | 1; 1/0/1 | source-only (증거·검산·역질문) | 0 / 0 |
| 646 | `tax_income::taxpayer` | I@tax_income | party_role; —; not_applicable; taxpayer | 1; 1/0/1 | source-only (증거·검산·역질문) | 0 / 0 |
| 647 | `tax_public_arrear::as_of_date` | T@tax_public_arrear; N@tax_public_arrear; S@tax_public_arrear | date; 원문 날짜→ISO; balance_as_of_date; taxpayer | 3; 1/0/1 | source-only (증거·검산·역질문) | 0 / 0 |
| 648 | `tax_public_arrear::assessment_date` | T@tax_public_arrear; N@tax_public_arrear; S@tax_public_arrear | date; 원문 날짜→ISO; assessment_date; taxpayer | 3; 1/0/1 | source-only (증거·검산·역질문) | 0 / 0 |
| 649 | `tax_public_arrear::authority` | T@tax_public_arrear; N@tax_public_arrear; S@tax_public_arrear | party_role; —; not_applicable; taxpayer | 3; 1/0/1 | source-only (증거·검산·역질문) | 0 / 0 |
| 650 | `tax_public_arrear::costs` | T@tax_public_arrear; N@tax_public_arrear; S@tax_public_arrear | money; 원문 통화·단위; not_applicable; taxpayer | 3; 1/1/1 | source-only (증거·검산·역질문) | 0 / 0 |
| 651 | `tax_public_arrear::debtor` | T@tax_public_arrear; N@tax_public_arrear; S@tax_public_arrear | party_role; —; not_applicable; taxpayer | 3; 1/0/1 | source-only (증거·검산·역질문) | 0 / 0 |
| 652 | `tax_public_arrear::due_date` | T@tax_public_arrear; N@tax_public_arrear; S@tax_public_arrear | date; 원문 날짜→ISO; due_date; taxpayer | 3; 1/0/1 | source-only (증거·검산·역질문) | 0 / 0 |
| 653 | `tax_public_arrear::issue_date` | T@tax_public_arrear; N@tax_public_arrear; S@tax_public_arrear | date; 원문 날짜→ISO; document_issue_date; taxpayer | 3; 1/0/1 | source-only (증거·검산·역질문) | 0 / 0 |
| 654 | `tax_public_arrear::principal_arrear` | T@tax_public_arrear; N@tax_public_arrear; S@tax_public_arrear | money; 원문 통화·단위; not_applicable; taxpayer | 3; 1/1/1 | material must_reconcile→`debt.principal` | 0 / 0 |
| 655 | `tax_public_arrear::surcharge_interest` | T@tax_public_arrear; N@tax_public_arrear; S@tax_public_arrear | money; 원문 통화·단위; not_applicable; taxpayer | 3; 1/1/1 | material must_reconcile→`debt.interest` | 0 / 0 |
| 656 | `tax_public_arrear::tax_period` | T@tax_public_arrear; N@tax_public_arrear; S@tax_public_arrear | period; 원문 날짜→ISO; tax_period_year; taxpayer | 3; 1/0/1 | source-only (증거·검산·역질문) | 0 / 0 |
| 657 | `tax_public_arrear::tax_type` | T@tax_public_arrear; N@tax_public_arrear; S@tax_public_arrear | category; —; not_applicable; taxpayer | 3; 1/0/1 | source-only (증거·검산·역질문) | 0 / 0 |
| 658 | `tax_public_arrear::total_due` | T@tax_public_arrear; N@tax_public_arrear; S@tax_public_arrear | money; 원문 통화·단위; not_applicable; taxpayer | 3; 1/1/1 | source-only (증거·검산·역질문) | 0 / 0 |
| 659 | `vehicle_registration::model_year` | V@vehicle_registry | integer; —; not_applicable; document_subject | 1; 0/1/0 | source-only (증거·검산·역질문) | 0 / 0 |
| 660 | `vehicle_registration::plate_number` | V@vehicle_registry | identifier; —; not_applicable; document_subject | 1; 0/0/0 | source-only (증거·검산·역질문) | 0 / 0 |

## 실제 원본 V8 격리 함수 관찰: 기대/입력/결과

1. **원본 `feature-lineage-audit.ts::hasPeriod/hasUnit/reviewScope` 함수본문 실행**: 20 ID×2=**40회** 기간/단위, 3패밀리×1=**3회** 검토후보. P=true **18/20**, U=true **7/20**, `temporal_role=not_applicable`인데 family regex로 P=true **10건**. `vehicle_registration::model_year`은 canonical_unit `not_applicable`인데 integer regex로 U=true **1건**. 데이터·시간 역할과 generic 술어의 차이는 **정책 검토 후보**, 자동 오류 확정이 아니다. 패밀리 후보: `tax_income`→D5103/D5110; `tax_public_arrear`→D5106/D5110; `vehicle_registration`→D5101/D5110. 공식 토큰과 동의어 아님.
2. **원본 `material-calculation-source-gate.ts::auditMaterialCalculatorSources()` 함수본문**: TypeScript type marker만 제거, 외부 `currentFacts`/`validSourceRef`/`moneyValue`/`createCaseReadIndex`는 명시적인 합성 stub; 직접 Node import/실 D1이 아님. 14개 **동작 기대·관찰 14/14 일치**. ① 원금 100·linked typed 100→0 issue ② typed 없음→`CALC_INPUT_UNCONNECTED_MATERIAL` ③ 100 vs 99→`CALC_INPUT_AMOUNT_MISMATCH` ④ 같은 Fact가 2 debt 행→`CALC_INPUT_MULTIPLE_TYPED_MATCHES` ⑤ sourceState unknown→`CALC_INPUT_AMOUNT_INVALID` ⑥ explicit_none/raw100→0 issue(관찰 범위) ⑦ 실제 0/typed0→0 issue ⑧ invalid ref→`CALC_INPUT_SOURCE_INVALID` ⑨ 가산금10/typed interest10→0 issue ⑩ 10 vs 9→`CALC_INPUT_AMOUNT_MISMATCH`. 아래 ⑪–⑭는 **정책상 차단·추가 검토가 필요하지만 이 좁은 게이트에서 경고하지 않는 반례**를 의도적으로 측정한 것:
   - ⑪ 출처 taxpayer A와 typed 채무자 B가 다른데 Fact ID·금액100은 같음 → **관찰 issueCount=0** (독립 업무 기대: 대상 불일치 차단/보류).
   - ⑫ 원천 과세기간/기준일 2025와 typed 기준일 2026이 다른데 금액100 일치 → **관찰 0** (업무 기대: 기간 검증 별도).
   - ⑬ #654 원금100 + #655 가산금10 + #658 총액999로 소계 불일치 → **관찰 0** (업무 기대: 동일 원천행 소계 검산 별도).
   - ⑭ 같은 채권의 3서류 증거를 각각 별도 typed debt 100에 연결 → **관찰 0** (업무 기대: 채무자·채권·세목·과세기간 기준 중복판별 별도).
   - **14/14는 원본 함수의 실제 경계 동작을 재현했다는 뜻**이며 ⑪–⑭의 업무상 합격 4/4가 아니다. 단독 소재 게이트의 검증 범위 공백이지 전체 `calculateCase()`의 확정 결함 판정은 아니다. 구조/소계/소유자·기간 승인 의미를 덧붙이는 패치는 법률·계산 고위험으로 즉시 main 변경하지 않는다.
3. **원본 `ocr-calculation-input.ts::calculationSourceCellIssues()` 함수본문**: `normalizeMoney`만 합성 stub, V8으로 10개 가상 field-local 입력 실행, **실제 분기 기대·관찰 10/10**. `year` 데이터형에 `20X5` 입력→오류 배열 없음; `period`에 `yesterday/today`→없음; `date`에 불가능 날짜 `2025-02-30`→`SOURCE_DATE_INVALID`; `date` 유효→없음; `money` 100 단위 없음→`SOURCE_MONETARY_UNIT_MISSING`; KRW exact100→없음; `integer` 20X5→`SOURCE_INTEGER_FORMAT_REVIEW`; 미관찰 null→없음; 원문 명시0/KRW→없음; year 정상2025→없음. **P2 후보:** `#645 tax_year`와 `#656 tax_period`의 형식은 이 필드 로컬 게이트에서 검증하지 않음. 원본 경계에서 보여준 범위 한계이지 상위 OCR parser나 법원 제출 요건에서 확정 오류라는 뜻이 아님.

## 누적 소비처 공백·위험 및 후속 검토

- **P2** `#659 vehicle_registration::model_year`, `#660 vehicle_registration::plate_number`: 서류 증거 라우트/원천 앵커는 존재하나 `field-applicability-contracts.json` 정확 ID의 sourceCondition 없음. 반영 시 sourceCondition null 가능. 적용조건 승인 **0%**; source-only 보존 및 별도 확인 질의(모델연식·차량번호 원문, 차량 식별자, 차량 소유·등록 대상) 필요.
- **P2 고위험 계산 검토** `#654 principal_arrear`와 `#655 surcharge_interest`은 `must_reconcile`인 반면 자동 direct typed 없음. `#650 costs`와 `#658 total_due`는 같은 source record에서 별도 증빙·검산 대상으로 보존한다. `100+10+costs`가 총액과 일치한다는 근거 없이 합산/차감 금지. VAT/세금/사회보험 법정 우선권과 현재 체납 인정은 채무 명의·세목·기간·기관·확정 여부·법원 관할 및 공식 법령/변호사 승인 후 판단. **값 0, null, 미관찰, 비해당, 충돌, source-only, 승인전은 서로 바꾸지 않는다.**
- **P2 연간 소득 기간 정합** `#641/#642`는 `income.period_start/end`에 direct typed 선언이 있으나 연간 `#637 income_after_expenses`가 월 인정소득에 자동 귀속되어서는 안 된다. 원문 `#645 tax_year`, 납세자 `#646 taxpayer`, 과세귀속시작·종료를 확인해 이전 r67 기간공백과 함께 상위 검증(실제 입력 기준)을 요구.
- **정확 소비처 0의 의미:** 16개 직접 typed+material 미연결 ID는 삭제 후보가 아닌 **원본 정합·증거목록·검산·역질문·법률 검토** 대상으로 유지. 특정 `reviewScope` D510x 후보는 token/binding 실증도, 승인 법률 evidence route도 아니다.
- **갈음/법원 보정:** `document-substitution.ts`는 검증된 Fact·서류/기간·검토자 경로를 요구하는 fail-closed 후보 경로이며, `preapproval-correction-audit.ts`는 법원 문서 기반 보정 추적을 요구한다. 이번 20개 ID와 실제 갈음 승인/법원 보정사항이 결합된 운영 사건·공식 제출/수리 영수증은 **미관찰**. 따라서 갈음 허용/보정 충족/변호사 승인 합격 **0%**.
- **검증수준:** 실행된 것은 GitHub JSON 정적 조인·원본 함수 경계의 격리 V8 합성시험뿐. 전체 `Node --test`/CI, 새 OCR, 실 DB Fact/typed readback, staging D1/R2/Cron, 공식 DOCX token/법원 양식, 법률 전문가 승인, 운영 배포/마이그레이션/전자제출 **모두 미실행 또는 미인증**. 사용자 제공 고객 문서/원본 OCR 사실값/개인정보/비밀키 일체 포함하지 않음.

## 중앙 보드 5개 미완료 체크 ID 부분 결과

- `A3-DATA-002`: 693→85문서/48패밀리/1,808 슬롯, #641–660 20/44 라우트와 원천행 경계 44/44 **선언** 재확인. 실 D1·R2 OCR 원천 재독 미인증.
- `A3-IT-003`: #641/#642 typed 2, #654/#655 material must 2, exact 18모듈/91입력 실행 미인증. source-to-typed identity/period/중복/소계 4개 반례 **게이트가 안 잡는 범위** 확인.
- `A3-DOC-008`: 세무/보험 3서류×12피처의 다중 evidence route + 소득증명/차량 원천 구별; 세목·발급일·체납기준일·보정/갈음 실사 필요.
- `A3-CALC-005`: 가상 원금/가산금 14개 게이트 결과/차단과 크로스채무자·기간·소계·중복 공백 분리. 값 승격·합산 금지.
- `A3-LAW-003`: 공적 체납의 우선·다툼/징수 비용·변제계획, 법원별 적용 규칙/시행일/실무자 승인 정확 contract 0, **미승인 0%**.
- **5개 모두 [ ] 유지**, 법률·회계 의미 변경, 제품 코드 변경, 운영 배포/실 제출 전혀 없음.

## 원본 증거 파일 blob SHA (읽은 main)

- `lib/canonical-field-id-index.json` blob `27ecdddd208de82a2f5c675e7482485e3a8838c2`
- `lib/document-agent-field-contracts.json` blob `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`
- `lib/shared-document-field-contracts.json` blob `9decab974e0909ae24ad927bdfe241d75b71f3a9`
- `lib/ocr-field-supplements.json` blob `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`
- `lib/field-applicability-contracts.json` blob `6076b26f782c4643a21a7b2f1a8f6261bb588b68`
- `lib/canonical-field-binding.ts` blob `60ee5c7762d52b72a165b4f4f8214680eb98f148`
- `lib/material-calculation-source-gate.ts` blob `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`
- `lib/ocr-chain-matrix.ts` blob `977de86ba698bd805cc6b95d1384e3b49d0dbb4c`
- `lib/feature-lineage-audit.ts` blob `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`
- `lib/legal-catalog.json` blob `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`
- `lib/risk-catalog.json` blob `e96dd0926e3ae9be5a5573d4551538ba294c4d2e`
- `lib/legal-exceptions.json` blob `6e51197226bfd8320e1147d8df3f12c11e00927c`
- `lib/ocr-calculation-input.ts` blob `8f7f51bf41f7c944b76419d7cc894e49ac771473`
- `lib/calculation-input-audit.ts` blob `288edc397527842c96874ef3e713f23bb534a5f1`
- `lib/legal-evidence-criteria.ts` blob `6c0b94535700d4fa4d356f8a91d5b9440b5ac52a`
- `lib/document-substitution.ts` blob `9fea9344b923c961fe333761df99ddde431ce1bc`
- `lib/preapproval-correction-audit.ts` blob `2cd18e22c9db4e5865f08b4d183f2d1751b0bf21`

## 다음 시작점

- 심층 재감사 **#660/693 (95.2%)**, 남은 **33 ID**. 다음 **#661 `vehicle_registration::record_issue_date` → #680**, 다음 역할 시작 **AX담당자**. r33 #641~660 정적 조사 결과와 r67 #621~640 결과를 누적한 심층 재감사에 해당하며, 인수 최종 완료 **0/124**.
- PR #51(기간검사), #155(부동산 귀속 진단) 등 미병합 수정과 영향범위를 검토하되 본 회차는 **고위험 의미 변경 PR/운영 배포 없음**.

<details>
<summary>최신 main canonical-field-id-index.json 전체 원문 순번 #1–693 (검증 인덱스 보존용)</summary>

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

</details>
