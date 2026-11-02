# FirmEngine A3 r83 — canonical OCR #121~130 사업자등록/매출 주체 소비처 재감사

> **2026-11-02 23:36 KST 기준 시작**. 업무 대상은 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 하위로 한정. 이 파일에는 실제 고객 문서·개인정보·원본 OCR 값·비공개 정답·키/.env가 전혀 없고 합성 사실만 사용한다. 이 영수증의 숫자는 **정적 계약/함수 격리실행**이지 법률요건 인정, native Node CI, 운영 DB/서식/배포 성공이 아니다.

## 1. 시작 상태·우선순위·회차 역할

- GitHub `main` 시작 HEAD **`30872f406613318e567ef3f19f88a3caf62c8b5c`** (감사 영수증 생성 직전 재조회); 최근 변경 A2 r83 `30872f40`, A1 r82 `d0e50d75`, 기타 A4 문서. 직전 A3 r82 [#111~120](20261102-r82-canonical-111-120-business-receipts-consumers-2230KST.md)에서 **#121**을 이어받았다. A3 선행 r42 [#121~140](20261101-r42-canonical-121-140-consumer-recheck-0631KST.md)의 식별·매출·갈음·보정 공백을 재검토했다.
- 역할 순환 **사용자·서류담당자 → 계산사무장 → 변호사 → 데이터담당자 → AX담당자 → IT담당자**. 실제 중앙 보드 개별 부분검증 5 ID: `A3-DOC-007`, `A3-CALC-002`, `A3-LAW-015`, `A3-DATA-013`, `A3-AX-017`. 모두 [ ] 미완료 유지. IT는 source-link 관점으로 교차검토했으나 이번 보드 부분변경 대상이 아니다.
- 이번 **#121~130 10 canonical ID / source route 40건 / 고유 문서 8종 / OCR 패밀리 2종**. 전체 **693 IDs(중복0)/48패밀리/85문서/1,808 선언 source routes(중복·고아0)**를 계약의 실제 배열에서 재집계. source-only/noCrossRecordBorrowing 선언 **40/40**. 10개 정확 sourceCondition 등록 **10/10**이나 승인된 법률 필수성은 **0건**.
- 실제 source DB `document_instances`, `extraction_records`, `extracted_features` 스키마에 문서/page/record ordinal/field ordinal/source SHA·raw_value_json 저장 필드 **코드 선언**을 조회. 문서 해시, bbox, quote, subjectId, row/period/currency가 실제 고객 OCR·D1에 채워졌는지는 **0건 미관찰**. `fieldObservation`의 sourceState, Fact recognition을 원본·0·null·explicit_none·conflict·승인전과 혼동하지 않는다.
- 실제 `reference-decision-tables.json` 계산 **18개/입력 91개**, `risk-catalog.json` **95**, `legal-catalog.json` **50**, `legal-exceptions.json` **46**, 템플릿 **18개** 정적 등록 재확인. 이번 ID 정확 canonical `must_reconcile/context_only` 직접 **0/10**, `canonical-field-binding.ts` typed 선언 **1/10 (#129 income.label)**, `ocr-chain-matrix.ts` 내부 exact token **0/10**, 법률 95/50/46 JSON에서 exact canonical 직접인용 **0/10**. 등록된 코드/법원승인은 구별한다.
- 관련 미병합 PR: [#39 사업자등록 source identity](https://github.com/firmengine/firmengine/pull/39), [#189 사업경비 후행증거](https://github.com/firmengine/firmengine/pull/189); 신규 **[Draft PR #193 등록/공동사업자 후행증거 지문 진단](https://github.com/firmengine/firmengine/pull/193)**. 신규 PR은 다른 브랜치의 테스트 파일 1개, control 1/RED 2 작성. **Native Node 미실행, 미병합**. 운영 코드/법률 의미 변경 없음.

## 2. #121~130 개별 소비처·원천·공백 표

열의 문서와 source datatype/단위/시간역할/주체 및 적용조건은 **카탈로그 선언값**이다. 각 행은 같은 canonical이라도 문서별/페이지별/복수행별·대상별·기간별 서로 독립된 원천이다. 실제 Fact가 저장/검증/typed 인식되었음을 뜻하지 않는다.

| # | canonical ID | 허용 source 서류(원천 슬롯) | datatype / unit / temporal_role / subject | ID별 sourceCondition | 코드에서 관찰한 기능적 소비·역질문 | 미확인 단계 |
|---:|---|---|---|---|---|---|
| 121 | `business_registration::business_items` | business_status_evidence, business_registration, business_contract, closure_certificate (4) | string / not_applicable / not_applicable / business_entity | registered lines of business | 사업 종목·범위 확인; 신규 업종 증거는 검토 의존성 후보 | typed —; material direct —; official exact token —; 법률 exact 승인 —; D1/원본/갈음/보정 미인증 |
| 122 | `business_registration::business_type` | business_status_evidence, business_registration, business_contract, closure_certificate (4) | string / not_applicable / not_applicable / business_entity | registered type | 사업유형 분류·수입 귀속 역질문 | typed —; material direct —; official exact token —; 법률 exact 승인 —; D1/원본/갈음/보정 미인증 |
| 123 | `business_registration::issue_date` | business_status_evidence, business_registration, business_contract, closure_certificate (4) | date / source date format normalized to ISO without loss / document_issue_date / business_entity | certificate issue | 증명 발급일; 개업/등록 효력일과 구별 | typed —; material direct —; official exact token —; 법률 exact 승인 —; D1/원본/갈음/보정 미인증 |
| 124 | `business_registration::joint_operators` | business_status_evidence, business_registration, business_contract, closure_certificate (4) | party_role / not_applicable / not_applicable / business_entity | each operator and recorded role | 공동사업자·귀속주체; 후행증거 시 기존 사업순액 검토 필요 | typed —; material direct —; official exact token —; 법률 exact 승인 —; D1/원본/갈음/보정 미인증 |
| 125 | `business_registration::opening_date` | business_status_evidence, business_registration, business_contract, closure_certificate (4) | date / source date format normalized to ISO without loss / effective_date / business_entity | activity start | 개업일·수입기간 대조; 후행증거 시 기간 재검토 후보 | typed —; material direct —; official exact token —; 법률 exact 승인 —; D1/원본/갈음/보정 미인증 |
| 126 | `business_registration::registration_date` | business_status_evidence, business_registration, business_contract, closure_certificate (4) | date / source date format normalized to ISO without loss / registration_effective_date / business_entity | effective registration | 등록 효력일; 영업일과 다름 | typed —; material direct —; official exact token —; 법률 exact 승인 —; D1/원본/갈음/보정 미인증 |
| 127 | `business_registration::representative` | business_status_evidence, business_registration, business_contract, closure_certificate (4) | party_role / not_applicable / not_applicable / business_entity | representative, not automatically owner | 대표자·실소유·사업자 귀속 검토, 직결 계산 없음 | typed —; material direct —; official exact token —; 법률 exact 승인 —; D1/원본/갈음/보정 미인증 |
| 128 | `business_registration::status` | business_status_evidence, business_registration, business_contract, closure_certificate (4) | category / not_applicable / not_applicable / business_entity | active/closed only as stated | 영업상태(active/closed) 새 증거→기존 검토 지문 공백 후보 | typed —; material direct —; official exact token —; 법률 exact 승인 —; D1/원본/갈음/보정 미인증 |
| 129 | `business_sales_vat::income.sales.business_entity` | business_income_report, vat_certificate, vat_exempt_certificate, sales_purchase_summary (4) | party_role / not_applicable / not_applicable / business_entity | Entity of sales record | `canonical-field-binding.ts` 직접 `income.label` (원천 사업체명; 신원 승인 아님); `business-identity-crosswalk.ts` 소득행 사업체 명칭 검토 | typed income.label; material direct —; official exact token —; 법률 exact 승인 —; D1/원본/갈음/보정 미인증 |
| 130 | `business_sales_vat::income.sales.exempt_sales` | business_income_report, vat_certificate, vat_exempt_certificate, sales_purchase_summary (4) | money / KRW / period_scope / business_entity | Exempt sales amount | `BUSINESS_SOURCE_MONEY_ROLES`의 `turnover_component`; `preflightBusinessNet`에서 같은 매출 원천행의 검산 보조증거, 별도 합산 금지 | typed —; material direct —; official exact token —; 법률 exact 승인 —; D1/원본/갈음/보정 미인증 |

**도큐먼트 세트 구분:** #121–128은 `business_status_evidence`, `business_registration`, `business_contract`, `closure_certificate` 각 8개의 route; #129–130은 `business_income_report`, `vat_certificate`, `vat_exempt_certificate`, `sales_purchase_summary` 각 2개 route. 발급일 #123, 개업일 #125, 등록 효력일 #126은 상호 대체 불가. 대표자 #127·공동사업자 #124·사업체명 #129도 동일 인물/실소유 자동확정 금지. 면세매출 #130은 총매출 #132의 구성요소 후보이며, 매출액·실수령액·영업순익·VAT에 무단 중복합산 불가.

**원천 locator 검사:** 이번 40개 route의 문서-패밀리-필드 선언, recordPolicy의 `noCrossRecordBorrowing=true`/`sourceOnly=true`, 필드별 통화·기간·대상 메타데이터를 각각 정적 대조. business_registration 필드는 `required_source_anchor`에 label/row/quote/bbox/hash/page 지시, VAT 필드는 `source_locator_required`와 `raw_value_required` 등 별도 메타데이터. 실제 OCR 페이지·동일행 결속·원문과 정규화 금액 일치·typed `income.label`의 D1 round-trip **미실행**.

## 3. 실행한 함수 V8 격리시험 — 독립 기대와 실제 반환을 분리

**3-1. 원본 `canonical-field-binding.ts:bindCanonicalSourceField`: 20/20 반환 계약 재현.** 이번 10개 정확 canonical ID × (원본 필드 key/ID 정상 입력 10개 → 해당 ID 반환; 잘못된 외부 family ID 10개 → `canonical_id_outside_family` 차단). 실제 브라우저/Node/DB 경로가 아닌 원본 함수본문의 TypeScript 표기만 제거한 V8 격리 실행. 별도 product CI 합격 아님.

**3-2. 원본 `ocr-calculation-input.ts:calculationSourceCellIssues`: 7/7 형식검사 반환 재현.** 합성 #123 `2026-02-30` → `SOURCE_DATE_INVALID`, #125 유효일 → [], #130 돈 `100` 단위 null → `SOURCE_MONETARY_UNIT_MISSING`, USD → `SOURCE_MONEY_NOT_EXACT_KRW`(KRW-only normalization stub), KRW → []; #128 `closed` 및 #124 공동사업자 문자열 → [] (셀 형식검사는 영업상태/공동소유의 의미를 검증하지 않음). 사내 원화환산 승인이나 합법성 인정과 무관.

**3-3. 원본 `business-identity-crosswalk.ts:valid`: 4개 합성, 독립 안전기대 3/4 충족.** 정상 verified/accepted/present → true, unreadable → false, unreviewed → false. `value=1234567890`와 `rawValue=9999999999`가 서로 충돌하는데 결과가 true(독립 기대 false). `factSourceLineageIssues`는 합성 empty stub이므로 **상위 원천검사 통과를 주장하지 않음**. 기존 Draft PR #39와 중복 제품수정 금지.

**3-4. 원본 `business-net-reconciliation.ts:businessNetReviewBasis`: 9개 합성, 독립 안전기대 5/9 충족.** 실제 함수 body와 원본 `factStamp/datesFor` 사용, 소스 색인·월/기준일·해시용 입력 일부 합성. 기존 sourceFactIds는 선택된 사업자등록번호 Fact, 매출/비용/기간·사업주체로 제한. 아래 independent `review`는 *새로운 사실이 들어왔을 때 검토를 요청해야 하는 후보*이지 항상 법률상 월 순소득 무효라고 판정한 것이 아니다.

| 합성 변경 | 독립 기대(보수적 검토) | 원본 snapshot 실제 | 해석 |
|---|---|---|---|
| baseline original selected IDs | baseline | unchanged | same (control) |
| #121 business_items added | review dependency candidate | unchanged | P2 review candidate |
| #124 joint_operators added | recheck ownership split | unchanged | P1 review candidate |
| #125 opening_date added | recheck income period | unchanged | P2 review candidate |
| #128 status=closed added | recheck operation status | unchanged | P1 review candidate |
| selected business registration value changed | changed snapshot | changed | meets |
| selected VAT owner source changed | changed snapshot | changed | meets |
| case asOf changed | changed snapshot | changed | meets |
| selected source ID missing | null | null | meets |

**새로운 P1 조사 후보:** #124 공동사업자 또는 #128 휴·폐업 상태의 증거가 선택된 `sourceFactIds` 밖에서 들어오면 `businessNetReviewBasis`의 결과가 변하지 않음. `preflightBusinessNet`는 사업자등록 source `business_id` 1개와 매출 행/비용 행의 금액·기간/사업체, 비용범주 중심으로 sourceFactIds를 구성. **승인된 사업소득 전체가 stale 되지 않는다고 확정하지 않음**: 상위 재투영·사람 검토·DB 저장 경로는 미검증, 사업 영업종료일/공동소유의 법률 의미는 사건별 실무자 승인 필요. 단지 새 증거의 검토 지문 추적이 충분한지 P1 후보.

**3-5. 기간/단위 플래그 원본 `feature-lineage-audit.ts` 조회:** #121/122/124/127/128의 시간 역할 not_applicable, #123/125/126의 날짜 역할, #129 사업체명 not_applicable, #130 면세매출 period_scope. `hasPeriod/hasUnit`의 원본 조건식으로 대표 합성 5가지 판정, 기간/단위 혼동 없는 현재 반환을 관찰. 문서 전체 조회기간·소득귀속기간과 셀 자체 날짜 요건은 별도.

## 4. 법률·서류요구·갈음·법원보정·서식 소비 경계

- `reference-intake-catalog.json`의 **INTAKE-004**에는 `business_status_evidence`(후보 대체 `business_registration`/`business_contract`), `business_income_report`(후보 대체 `financial_statement`), `sales_purchase_summary`, `operating_expenses`, `income_amount_certificate`의 요구 분기가 등록. **INTAKE-005**에는 사업자등록증 `business_registration` 직접 요구 분기(대체목록 없음). 두 경로를 서로 자동대체/법원 승인으로 오인하지 않는다.
- `substitution-policy.json`에서 `business_income_report → financial_statement` 허용 조건 경로 **서울 1, 부산 1**을 선언했으나 사건별 B+C 증거 충족/직원 승인·원본 문서해시/기간/대상/서명/법원 시행일 검증은 **미관찰**. `document-substitution.ts` 및 `approve-document-substitution.ts`는 같은 source Fact, 문서, 페이지, 사람 검토 지문을 재대조하는 별도 경로. 정확 canonical #121~130의 증거가 실제 갈음 승인된 테스트는 0건.
- `preapproval-correction-audit.ts`, `preapproval-correction-item-store.ts`는 **실제 법원 발급 보정명령 원문/기한/절차 이벤트**가 있어야 하는 독립 경로이며 #121~130을 보정 요구로 자동 지정하는 계약으로 해석하지 않았다. 보정서 기한·원문·접수결과 실증 0건.
- `form-mapping.ts`의 `business_name`, `business_type`, `business_registration`, `opening_date` 등 일부 **일반 내부 alias** 및 `calculation.incomeRows` 경로는 코드 존재 확인. 정확 canonical #121~130의 인가된 공식 템플릿 token·출력 diff, 변호사 승인 0건. alias만으로 source-only를 확정 양식값으로 승격 금지.
- 모든 고위험 법률·금액 의미 변경은 Draft PR #193로 테스트만 분리. PR #39/#189 충돌 검토, 이력·원천/승인·재판부/시행일 확인 및 Native Node/CI, D1/R2/Cron staging, 공식 서식 실증까지 **검토전**. 운영 배포·D1 운영 migration·전자제출·법원 인가 확정 **하지 않음**.

## 5. 보드 5 ID 부분 감사 영수증·승격 금지

- `A3-DOC-007` [ ]: #121~130 8 문서/40 source route, 사업자등록 대체 후보/부가세 원천구분 및 요구분기 정적 검증. 실서류·실법원 갈음/보정 0.
- `A3-CALC-002` [ ]: #130 면세매출은 구성요소/검산 전용; #132 총매출·VAT·순익과 비합산, #129 주체명 typed label만 선언. 산식 전체·승인 0.
- `A3-LAW-015` [ ]: 95 위험/50 규칙/46 예외 정확 canonical 계약 0; 공동사업·폐업 적용요건/시행일·관할·변호사 검토 미실행. 미승인 요건은 **0% 합격**.
- `A3-DATA-013` [ ]: 10 ID/40 route, source quote/page/row/hash·rawValue/typed/법률/서식 lineage 정적 연결; 실제 DB 저장·typed 재독/문서 비교 0.
- `A3-AX-017` [ ]: 후행 #124/#128의 basis 누락 P1 후보를 원본 snapshot V8 합성으로 관찰; PR #193는 테스트만 작성·미병합, native Node 미실행. 지문 갱신/승인무효화 실제 E2E 미검증.

**상태 분리**: `unobserved`, `null`, `0`, `not_applicable`, `conflicting`, `source_only`, `unreviewed`, `review_required`, `accepted_by_human`은 서로 동의어가 아니다. 원천 증거 자동 삭제·무단 원화합산·무단 법률 확정 승격 금지.

**A3 제품 최종 인수 0/124; 완료 체크 0** (본 회차는 소스/합성 부분만 기재). 기존 693개 정적 순번 전수와 이번 개별 10개 소비처 검증은 별개. 실제 OCR 고객원문, D1 Fact/typed readback, 전체 CI, staging D1/R2/Cron, 18 계산 E2E, 공식 법원 서식·변호사 승인은 여전히 **미인증**.

**다음 시작 ID #131 `business_sales_vat::income.sales.filing_date`**, 다음 범위 #131~140, 역할은 **IT담당자**부터 순환. 첫 쟁점: VAT 신고일/원문 발급일·매출 총액/과세매출/환불/VAT·거래건수의 중복계상 및 서류 대체/보정.

## 6. 실제 조회한 현재 main 관련 blob SHA

- `lib/canonical-field-id-index.json`: `27ecdddd208de82a2f5c675e7482485e3a8838c2`
- `lib/document-agent-field-contracts.json`: `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`
- `lib/shared-document-field-contracts.json`: `9decab974e0909ae24ad927bdfe241d75b71f3a9`
- `lib/ocr-field-supplements.json`: `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`
- `lib/field-applicability-contracts.json`: `6076b26f782c4643a21a7b2f1a8f6261bb588b68`
- `lib/reference-decision-tables.json`: `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`
- `lib/legal-catalog.json`: `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`
- `lib/legal-exceptions.json`: `6e51197226bfd8320e1147d8df3f12c11e00927c`
- `lib/risk-catalog.json`: `e96dd0926e3ae9be5a5573d4551538ba294c4d2e`
- `lib/reference-intake-catalog.json`: `ae6aa4fd2ef11ee0266b5ad05b2f9a96164daa99`
- `lib/substitution-policy.json`: `cfb81e2f0c7ba0923d075f7612fa2b7a01bac68c`
- `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`: `fa9cefeac849b1b256d0784198d76a11584c4eff`
- `lib/business-net-reconciliation.ts`: `60a4fc295943dce404a7f99efffe88f58dd2d4ff`
- `lib/business-identity-crosswalk.ts`: `73331de276f9bc78e2c9d43fc48e179cf6ba161c`
- `lib/canonical-field-binding.ts`: `60ee5c7762d52b72a165b4f4f8214680eb98f148`
- `lib/ocr-calculation-input.ts`: `8f7f51bf41f7c944b76419d7cc894e49ac771473`
- `lib/feature-lineage-audit.ts`: `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`
- `db/schema.ts`: `933f8686845ac14669312dd21bf85e02c62ed5e6`
- `lib/document-substitution.ts`: `9fea9344b923c961fe333761df99ddde431ce1bc`

## 부록 A. 최신 canonical OCR 693개 정확 순번 전수 열거

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

## 부록 B. 중앙 보드 A3 6담당자 체크 ID 124개 — 실제 열거

001. `A3-IT-001`
002. `A3-IT-002`
003. `A3-IT-003`
004. `A3-IT-004`
005. `A3-IT-005`
006. `A3-IT-006`
007. `A3-IT-007`
008. `A3-IT-008`
009. `A3-IT-009`
010. `A3-IT-010`
011. `A3-IT-011`
012. `A3-IT-012`
013. `A3-IT-013`
014. `A3-IT-014`
015. `A3-IT-015`
016. `A3-IT-016`
017. `A3-IT-017`
018. `A3-IT-018`
019. `A3-IT-019`
020. `A3-IT-020`
021. `A3-DOC-001`
022. `A3-DOC-002`
023. `A3-DOC-003`
024. `A3-DOC-004`
025. `A3-DOC-005`
026. `A3-DOC-006`
027. `A3-DOC-007`
028. `A3-DOC-008`
029. `A3-DOC-009`
030. `A3-DOC-010`
031. `A3-DOC-011`
032. `A3-DOC-012`
033. `A3-DOC-013`
034. `A3-DOC-014`
035. `A3-DOC-015`
036. `A3-DOC-016`
037. `A3-DOC-017`
038. `A3-DOC-018`
039. `A3-DOC-019`
040. `A3-DOC-020`
041. `A3-CALC-001`
042. `A3-CALC-002`
043. `A3-CALC-003`
044. `A3-CALC-004`
045. `A3-CALC-005`
046. `A3-CALC-006`
047. `A3-CALC-007`
048. `A3-CALC-008`
049. `A3-CALC-009`
050. `A3-CALC-010`
051. `A3-CALC-011`
052. `A3-CALC-012`
053. `A3-CALC-013`
054. `A3-CALC-014`
055. `A3-CALC-015`
056. `A3-CALC-016`
057. `A3-CALC-017`
058. `A3-CALC-018`
059. `A3-CALC-019`
060. `A3-CALC-020`
061. `A3-LAW-001`
062. `A3-LAW-002`
063. `A3-LAW-003`
064. `A3-LAW-004`
065. `A3-LAW-005`
066. `A3-LAW-006`
067. `A3-LAW-007`
068. `A3-LAW-008`
069. `A3-LAW-009`
070. `A3-LAW-010`
071. `A3-LAW-011`
072. `A3-LAW-012`
073. `A3-LAW-013`
074. `A3-LAW-014`
075. `A3-LAW-015`
076. `A3-LAW-016`
077. `A3-LAW-017`
078. `A3-LAW-018`
079. `A3-LAW-019`
080. `A3-LAW-020`
081. `A3-LAW-021`
082. `A3-LAW-022`
083. `A3-DATA-001`
084. `A3-DATA-002`
085. `A3-DATA-003`
086. `A3-DATA-004`
087. `A3-DATA-005`
088. `A3-DATA-006`
089. `A3-DATA-007`
090. `A3-DATA-008`
091. `A3-DATA-009`
092. `A3-DATA-010`
093. `A3-DATA-011`
094. `A3-DATA-012`
095. `A3-DATA-013`
096. `A3-DATA-014`
097. `A3-DATA-015`
098. `A3-DATA-016`
099. `A3-DATA-017`
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
