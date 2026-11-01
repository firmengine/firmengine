# FirmEngine A3 r46 — canonical #201–220 증거·계산·법률·서식 소비처 재감사 (2026-11-01 KST)

## 1. 감사 기점·책임 및 실제 검증
- 시작 최신 GitHub main HEAD: `8ec4387139a87f4c2c0795b77fce146a0801917b`; 직전 A3 r45 #181–200 영수증, 이전 최초 r11 #201–220 영수증, 단일 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`, 최근 main A1/A2/A4 커밋 및 기존 Draft #51/#54/#109 등을 조회. 허용 범위는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부로 제한.
- 이번 5 역할 순환: **IT담당자 → 사용자·서류담당자 → 계산사무장 → 변호사 → 데이터담당자**. 보드 체크 ID: `A3-IT-006`, `A3-DOC-015`, `A3-CALC-020`, `A3-LAW-003`, `A3-DATA-008`; 모두 부분 확인·**[ ] 유지**, 인수 0건. 다음 시작 역할 **AX담당자**.
- 실제 테스트 입력: 아래 20개 정확 canonical ID와 각 문서의 base+extension+supplement 계약, 원본 datatype/unit/temporal/subject, 적용조건, 명시적 typed projection, calculation source policy, 직접 form token, 법률위험/규칙/예외의 exact canonical literal, 각 문서 recordPolicy. 독립 JS로 **693개 전체를 인덱스 순서로 열거**하여 모든 문서별 허용 family를 실제 결합함. 구조/정확 연결 불변식 **23/23** 일치; 미검증 실제 인식·사건판단을 합격에 포함하지 않음.
- 원본 `lib/feature-lineage-audit.ts`에서 실제 `hasPeriod(role,family)` 및 `hasUnit(datatype)` 표현식만 추출해 **V8 격리 실행 각각 20회**. 개별 필드 시간역할 기준 독립 기대: period true **10**, false **10**; 관찰 true **13**, false **7**. **3건 불일치** (#202, #203, #204); 단위판정 20/20 일치(원단위 검토 후보 #201, #208, #211). 합성/정적 함수 테스트일 뿐 전체 Node CI 아님.
- 전수 조인 결과 **693 고유 / 85 서류 / 48 family / 1,808 원천 라우트**, 미등록 canonical 고아 0, source 고아 0, datatype/unit/local-key 충돌 0. **계산 18모듈·91 input 선언(고유 78), 법률위험 95 / 규칙 50 / 예외 46**. 이번 #201–220은 **20개 / 36 source routes / 7 서류**, anchor 20/20, 기록 분할·`noCrossRecordBorrowing=true` 선언 20/20, 적용조건 **13/20**; 직접 typed **0**, material 산식 **0**, 정확 공식 토큰 선언 **0**, 정확 법률 ID 증거계약 **0**. 선언은 실제 실행 보증이 아님.
- 신규 확인 없이 기존에 관찰하지 않은 원본 페이지·문서 SHA·bbox/quote, 복수행 실데이터, 실제 Fact/typed 값, 계산 run, 승인·수리, 공식 현재 법원 서식·법원 보정, D1/R2/Cron, 전체 Node/CI·사이트 배포는 **일절 실행·인증하지 않음**.

## 2. #201–220 — 개별 원천 서류·단위·기간·대상·직접 소비처/공백

아래 슬롯=문서 유형×family×필드 **계약 선언 수**; 실제 고객 PDF/페이지 수·Fact 수가 아님. 계약은 원본 문서hash·페이지·인용/좌표·원문 행과 대상/기간 식별 및 독립 기록 분할을 요구한다. 이번에 실제 값을 읽은 적 없으므로 `not_seen` / null / 실제 0 / `explicit_none` / `conflicting` / source-only / 승인전은 서로 대체하지 않는다.

| # | exact canonical ID | source slots; document types | datatype / source unit | temporal / subject | 정확 적용조건 | 직접 typed·계산·서식·법률 계약 |
|---:|---|---|---|---|---|---|
| 201 | `conditional_nonstandard_income_or_household_event::conditional.change.income_delta` | 5; employment_history, medical_expense_evidence, closure_certificate, divorce_records, income_household_change_evidence | money / KRW | period_scope / applicant_debtor | 등록(미승인) | typed 0; calculation 0; form 0; exact-law 0 |
| 202 | `conditional_nonstandard_income_or_household_event::conditional.change.issuer` | 5; employment_history, medical_expense_evidence, closure_certificate, divorce_records, income_household_change_evidence | party_role / not_applicable | not_applicable / issuer | 등록(미승인) | typed 0; calculation 0; form 0; exact-law 0; 기간 과잉후보 |
| 203 | `conditional_nonstandard_income_or_household_event::conditional.change.new_status` | 5; employment_history, medical_expense_evidence, closure_certificate, divorce_records, income_household_change_evidence | text_or_enum / not_applicable | not_applicable / applicant_debtor | 등록(미승인) | typed 0; calculation 0; form 0; exact-law 0; 기간 과잉후보 |
| 204 | `conditional_nonstandard_income_or_household_event::conditional.change.old_status` | 5; employment_history, medical_expense_evidence, closure_certificate, divorce_records, income_household_change_evidence | text_or_enum / not_applicable | not_applicable / applicant_debtor | 등록(미승인) | typed 0; calculation 0; form 0; exact-law 0; 기간 과잉후보 |
| 205 | `conditional_plan_funding_source::applicability.form.current_official_version` | 1; plan_funding_statement | version_record / not_applicable | not_applicable / authority | 등록(미승인) | typed 0; calculation 0; form 0; exact-law 0 |
| 206 | `conditional_plan_funding_source::applicability.form.disposition_asset_ids` | 1; plan_funding_statement | id_list / not_applicable | proposed_plan_period_scope / owner_legal | 등록(미승인) | typed 0; calculation 0; form 0; exact-law 0 |
| 207 | `conditional_plan_funding_source::applicability.form.disposition_date` | 1; plan_funding_statement | date / not_applicable | proposed_event_date / applicant_debtor | 등록(미승인) | typed 0; calculation 0; form 0; exact-law 0 |
| 208 | `conditional_plan_funding_source::applicability.form.disposition_proceeds` | 1; plan_funding_statement | money / KRW | proposed_plan_period_scope / applicant_debtor | 등록(미승인) | typed 0; calculation 0; form 0; exact-law 0 |
| 209 | `conditional_plan_funding_source::applicability.form.income_source_evidence_ids` | 1; plan_funding_statement | id_list / not_applicable | proposed_plan_period_scope / applicant_debtor | 등록(미승인) | typed 0; calculation 0; form 0; exact-law 0 |
| 210 | `conditional_plan_funding_source::applicability.form.plan_source` | 1; plan_funding_statement | enum / not_applicable | proposed_plan_period_scope / applicant_debtor | 등록(미승인) | typed 0; calculation 0; form 0; exact-law 0 |
| 211 | `conditional_plan_funding_source::applicability.form.proceeds_to_plan` | 1; plan_funding_statement | money / KRW | proposed_plan_period_scope / applicant_debtor | 등록(미승인) | typed 0; calculation 0; form 0; exact-law 0 |
| 212 | `conditional_plan_funding_source::applicability.form.review_status` | 1; plan_funding_statement | enum / not_applicable | not_applicable / representative | 등록(미승인) | typed 0; calculation 0; form 0; exact-law 0 |
| 213 | `conditional_plan_funding_source::applicability.form.selected_form_code` | 1; plan_funding_statement | enum / not_applicable | not_applicable / authority | 등록(미승인) | typed 0; calculation 0; form 0; exact-law 0 |
| 214 | `credit_information_report::assignment_event_date` | 1; credit_information_report | date / not_applicable | source_date_time_or_period / document_subject | 미등록(0% 합격) | typed 0; calculation 0; form 0; exact-law 0 |
| 215 | `credit_information_report::current_reported_creditor` | 1; credit_information_report | party_role / not_applicable | not_applicable / document_subject | 미등록(0% 합격) | typed 0; calculation 0; form 0; exact-law 0 |
| 216 | `credit_information_report::event_record_id` | 1; credit_information_report | identifier / not_applicable | not_applicable / document_subject | 미등록(0% 합격) | typed 0; calculation 0; form 0; exact-law 0 |
| 217 | `credit_information_report::issue_date` | 1; credit_information_report | date / not_applicable | source_date_time_or_period / document_subject | 미등록(0% 합격) | typed 0; calculation 0; form 0; exact-law 0 |
| 218 | `credit_information_report::previous_creditor` | 1; credit_information_report | party_role / not_applicable | not_applicable / document_subject | 미등록(0% 합격) | typed 0; calculation 0; form 0; exact-law 0 |
| 219 | `credit_information_report::report_as_of` | 1; credit_information_report | date / not_applicable | source_date_time_or_period / document_subject | 미등록(0% 합격) | typed 0; calculation 0; form 0; exact-law 0 |
| 220 | `credit_information_report::report_subject` | 1; credit_information_report | party_role / not_applicable | not_applicable / document_subject | 미등록(0% 합격) | typed 0; calculation 0; form 0; exact-law 0 |

## 3. 소비처별 공백·역질문·기존 결함 추적
1. **P2 등록 공백 7건**: #214–220은 `credit_information_report`의 `credit_report` 문서확장 원천슬롯으로 정확한 canonical 등록은 있으나 `field-applicability-contracts.json`의 `credit_report.fields`에는 동 ID가 없음. 정확 등록 0/7이므로 적용조건 **합격 0%**. 기존 r11에서도 지적되어 미해결임. 확장전용 정책/담당자 등록 의도를 확인하기 전 자동 등록·폐기 금지. 원문은 신용정보조회 당시 현황이지 채무 잔액증명/법적 현재 채권자 확정이 아님.
2. **P2 시간 메타데이터 부정확 3건**: #202 원천 발행/담당기관, #203 변경 후 상태, #204 변경 전 상태는 `temporal_role=not_applicable`이나 원본 `hasPeriod`에서 family 이름의 `income` 때문에 `true`로 과잉 표시됨. 개별 필드와 전체 사건 변동일을 분리해야 함. 원본 함수 격리 **3/20 period 결과 기대 불일치**, 기존 기간 분기 수정 Draft [#51](https://github.com/firmengine/firmengine/pull/51) 미병합·동일파일 수정 충돌 우려; 실제 OCR 거절은 미재현.
3. **수입/가구 변동**: #201은 신고·진술된 소득 변화액이지 현재 인정 월소득이 아니다. 직전/변경후/효력일/발급기관·동일인 및 기존 급여 입금과 대조한 뒤 기간 검산·역질문이 필요. #201–204의 원본 라우트가 다섯 서류에 중복 선언된 것이 독립 소득 다섯 건을 뜻하지 않음.
4. **변제계획 재원·서식**: #205 공식 서식 버전은 증거·제안 기록이지 공식 최종판 확인이 아님. #206 처분재산 ID, #207 예정일, #208 예상대금, #209 수입증거, #210 계획재원, #211 계획투입액, #212 검토상태, #213 선택코드는 **모두 source-only 계약**이며 실 계산·D5110/D5111 writer에 정확 ID로의 typed/토큰 링크 없음. #208과 #211을 별도 현금흐름으로 합산 금지. 승인 없는 `review_status` 문자열을 직원/변호사 승인으로 오인 금지. `intake-court-coverage.ts` INTAKE-067은 해당 자료를 **내부 작성·검수**로 지정(외부 발급요청 아님). 별도 계산·서식 버전·실무자 승인 확인 필수.
5. **신용정보·채권양도**: #214 양도 이벤트일 / #215 조회상 현재 채권자 / #216 사건별 record ID / #217 발급일 / #218 이전 채권자 / #219 기준일 / #220 조회대상은 서로 다른 시간·주체/원문행에 묶여야 함. `intake-court-coverage.ts` INTAKE-055는 채권자 누락 점검 *권장자료*이며 **현 채무잔액증명을 대체하지 않음**. D5106 채권자/원금/이자/주소·양도통지의 정확 법적 승인·소비처 미검증. 동일 채권을 구채권자·신채권자 두 채무로 합산 금지.
6. **DB/Fact/갈음·보정**: `db/schema.ts`, `extraction-row-store.ts`에는 extraction_records·extracted_features의 canonical ID/원문·단위·sourceState·quote·bbox 및 coverage 구조가 있지만 **실제 36개 원천이 저장/재독되어 typed·계산·법률·서식에 연결됐다는 증거는 없음**. 7개 문서 recordPolicy의 `noCrossRecordBorrowing=true`는 선언이며 실제 동일인/동일 채권 기록 경계를 통과한 E2E가 아님. `docs/substitution-coverage-matrix.json`의 두 대상 서류 모두 `primary_required_no_auto_substitution`; B+C 갈음 승인이나 실제 법원 보정이 실행·승인됐다고 볼 수 없음. 기존 서로 다른 대상자 Fact의 페이지 교차 소비 위험 수정 [Draft #54](https://github.com/firmengine/firmengine/pull/54) 별도 통합 필요.
7. **법률 증거 미등록**: 해당 20 canonical에 대해 위험95·규칙50·예외46의 정확 ID 직접 계약 **0/20**, 법률승인·법원 수리 상태 **0% 합격**. 서류/가족·프로시저 위험 *후보*와 법률 증거·판본/관할 인정은 분리. 직접 계산/서식0도 증거 무용·자동폐기 사유가 아니다.

## 4. 중앙 보드 검증 ID 5건 (모두 [ ] / 부분)
- `A3-IT-006` — source-only/원천 36 slots·7 document types·원본 보존 및 7개 적용조건 등록 공백 확인. 실 D1 원문 재독·삭제방지 E2E 없음.
- `A3-DOC-015` — #214–220 원천 채권자·이력 ID·조회대상·기준일 경계와 INTAKE-055 추가조회/역질문 경로 정적 확인; 실제 채권자 목록/갈음/보정 E2E 없음.
- `A3-CALC-020` — #201 신고 차액, #208 예상 처분대금, #211 변제계획 투입액은 직접 material/typed 계산0이며 중복 합산 불가; 계산식·계획서 최종 실주입 미검증.
- `A3-LAW-003` — 신용정보 조회상 채권자와 현재 채권증명/양도증거·담보/다툼 등 법률 분기 구별, 95/50/46 정확 ID 0; 법률·변호사 승인 미확인.
- `A3-DATA-008` — 7서류 모두 recordPolicy `sourceOnly`/`noCrossRecordBorrowing` 선언 확인; 다른 사람/채권자/기간의 복수행 교차 차용이 실제 DB/Fact에서 차단되는지 검증되지 않음.

**다음 시작 #221 `credit_report::currency_unit`**, 심층 재감사 #221–240; 역할 **AX담당자**부터 순환. 현재 최초 순차 정적 조사 693/693, 심층 재감사 **220/693**, 제품 인수 체크 0/124. 임의 원화합산·실고객/비공개답/키 공개 저장·운영 배포/마이그레이션·전자제출·법원 인가확정 없음.

## 5. 실제 조회한 파일 blob SHA
| 정확 파일 | SHA |
|---|---|
| `lib/canonical-field-id-index.json` | `27ecdddd208de82a2f5c675e7482485e3a8838c2` |
| `lib/document-agent-field-contracts.json` | `9884b3fecf44643fefcdc4a421ed66ffc5477b3a` |
| `lib/shared-document-field-contracts.json` | `9decab974e0909ae24ad927bdfe241d75b71f3a9` |
| `lib/ocr-field-supplements.json` | `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5` |
| `lib/field-applicability-contracts.json` | `6076b26f782c4643a21a7b2f1a8f6261bb588b68` |
| `lib/risk-catalog.json` | `e96dd0926e3ae9be5a5573d4551538ba294c4d2e` |
| `lib/legal-catalog.json` | `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e` |
| `lib/legal-exceptions.json` | `6e51197226bfd8320e1147d8df3f12c11e00927c` |
| `lib/reference-decision-tables.json` | `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` |
| `lib/canonical-field-binding.ts` | `60ee5c7762d52b72a165b4f4f8214680eb98f148` |
| `lib/ocr-chain-matrix.ts` | `977de86ba698bd805cc6b95d1384e3b49d0dbb4c` |
| `lib/material-calculation-source-gate.ts` | `0286b44484913b63fa8ec3f7bf0ca59b034d0dab` |
| `lib/feature-lineage-audit.ts` | `de81bc3b8c460b8a4dde3fda9e13087e619e74ff` |
