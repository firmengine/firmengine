# FirmEngine A3 r45 — canonical #181~200 소비처 심층 재감사 (2026-11-01 KST)

## 1. 독립 조회 기준·검증 경계
- 시작 GitHub main HEAD: `070d3c20462379f9a51fa0982d0a35bbb0c45be4`. 직전 r44 #161~180와 최초 r10 #181~200, 중앙 인수 보드의 A3 ID를 읽고 이어서 진행.
- **역할 순환** AX담당자 → 사용자·서류담당자 → 계산사무장 → 데이터담당자 → 변호사. 선택 5 ID: `A3-AX-013`, `A3-DOC-018`, `A3-CALC-009`, `A3-DATA-018`, `A3-LAW-008`. 모두 부분 확인만, **[ ] 유지**.
- 최신 main 실제 JSON 원문 13개 파일과 `feature-lineage-audit.ts`, `canonical-field-binding.ts`, `ocr-chain-matrix.ts` 등의 소비처 소스 조회. `hasPeriod/hasUnit`는 현행 TS에서 함수식만 꺼내 V8 JS로 격리실행; 프로젝트 import/Node 전체 테스트 아님.
- 693/693 canonical ID는 번호·중복 검증했고, **85 증빙문서 × 48 family × base + shared extension + OCR supplements** 조인 결과 정확 **1,808 source route**(693 고유 ID, 고아·오염 0). supplemental OCR 19 슬롯을 빠뜨린 base+shared 1,789 슬롯은 완전한 카탈로그가 아니므로 사용 금지.
- 이번 20개 ID의 **44 원천 라우트 / 6 고유 서류**, 정확 적용조건 20/20, 원천 anchor 정의 및 noCrossRecordBorrowing 정책 20/20, 직접 typed 선언 0/20, 정확 서식 토큰 0/20, 계산 `must_reconcile` 0, `context_only` 1(#189), 95 위험·50 규칙·46 예외에서 **정확 canonical ID 증거계약 0/20**. 등록·검토후보와 법률승인은 별개.
- 실제 실행 입력: 아래 20 canonical의 `datatype`, `temporal_role`, `canonical_unit`, `subject_entity_role`, 적용조건 및 원천 문서라우트. 독립 기대: 명시 `temporal_role=not_applicable`인 **개별 필드** 자체는 기간 필수로 보지 않고, 다른 시간역할은 기간 검토대상. 원본 `hasPeriod` 20회/ `hasUnit` 20회 V8 실행. period: 기대 **14 true/6 false**, 관찰 **20 true/0 false**로 **6건 불일치**(#181,#183,#190,#191,#194,#195). unit: 금액 6 true/기타14 false, 실제도 6/14. 별도로 20개 정적 데이터 계약 조인 완료.
- 원문 문서·페이지·복수행 실측/quoted fact/DB Fact·typed 저장/실제 법률 승인/공식 서식 비교/운영 D1·R2·Cron/전체 CI/사이트 배포/법원 제출 **미실행·미인증**. 적합성 전체 합격률로 읽지 않는다.

## 2. 정확 20개 ID: 문서·단위·기간·대상·소비처/공백
서류수·슬롯은 **선언 라우트**이며 관찰된 PDF 수/페이지 수/DB fact 수가 아니다. 계약은 document_id·SHA·page·quote·row locator와 별도 subject identity 요구; 실제 추출값·동일인·복수행 충돌을 확인하지 못했으므로 `not_seen`/null/0/`explicit_none`/`conflicting`/`source_only`/승인전은 각각 구분한다.

| # | 정확 canonical ID | 슬롯 / 서류 | datatype / 원단위 | temporal / subject | applicability | typed·계산·서식·법률 소비처/공백 |
|---:|---|---|---|---|---|---|
| 181 | `conditional_education_childcare::conditional.education.relation` | 1 / education_expense_evidence | relationship_enum / not_applicable | not_applicable / household_member | 등록·승인전 | typed 0; 미선언(source-only 후보); token 0; exact law 0; 기간 과잉후보(P2) |
| 182 | `conditional_education_childcare::conditional.education.subsidy` | 1 / education_expense_evidence | money / KRW | period_scope / household_member | 등록·승인전 | typed 0; 미선언(source-only 후보); token 0; exact law 0; 개별 역할 대조 |
| 183 | `conditional_medical_expense::conditional.medical.applicant_relation` | 1 / medical_expense_evidence | relationship_enum / not_applicable | not_applicable / household_member | 등록·승인전 | typed 0; 미선언(source-only 후보); token 0; exact law 0; 기간 과잉후보(P2) |
| 184 | `conditional_medical_expense::conditional.medical.billed_cost` | 1 / medical_expense_evidence | money / KRW | event_date / household_member | 등록·승인전 | typed 0; 미선언(source-only 후보); token 0; exact law 0; 개별 역할 대조 |
| 185 | `conditional_medical_expense::conditional.medical.care_period_end` | 1 / medical_expense_evidence | date / not_applicable | statement_period_end / household_member | 등록·승인전 | typed 0; 미선언(source-only 후보); token 0; exact law 0; 개별 역할 대조 |
| 186 | `conditional_medical_expense::conditional.medical.care_period_start` | 1 / medical_expense_evidence | date / not_applicable | statement_period_start / household_member | 등록·승인전 | typed 0; 미선언(source-only 후보); token 0; exact law 0; 개별 역할 대조 |
| 187 | `conditional_medical_expense::conditional.medical.expected_recurring_cost` | 1 / medical_expense_evidence | money / KRW | period_scope / household_member | 등록·승인전 | typed 0; 미선언(source-only 후보); token 0; exact law 0; 개별 역할 대조 |
| 188 | `conditional_medical_expense::conditional.medical.medical_opinion_period` | 1 / medical_expense_evidence | text_or_date_range / not_applicable | period_scope / household_member | 등록·승인전 | typed 0; 미선언(source-only 후보); token 0; exact law 0; 개별 역할 대조 |
| 189 | `conditional_medical_expense::conditional.medical.paid_cost` | 1 / medical_expense_evidence | money / KRW | event_date / household_member | 등록·승인전 | typed 0; context_only (dest=null); token 0; exact law 0; 개별 역할 대조 |
| 190 | `conditional_medical_expense::conditional.medical.patient` | 1 / medical_expense_evidence | party_role / not_applicable | not_applicable / household_member | 등록·승인전 | typed 0; 미선언(source-only 후보); token 0; exact law 0; 기간 과잉후보(P2) |
| 191 | `conditional_medical_expense::conditional.medical.provider` | 1 / medical_expense_evidence | party_role / not_applicable | not_applicable / issuer | 등록·승인전 | typed 0; 미선언(source-only 후보); token 0; exact law 0; 기간 과잉후보(P2) |
| 192 | `conditional_medical_expense::conditional.medical.reimbursement` | 1 / medical_expense_evidence | money / KRW | event_date / household_member | 등록·승인전 | typed 0; 미선언(source-only 후보); token 0; exact law 0; 개별 역할 대조 |
| 193 | `conditional_medical_expense::conditional.medical.service_date` | 1 / medical_expense_evidence | date / not_applicable | service_date / household_member | 등록·승인전 | typed 0; 미선언(source-only 후보); token 0; exact law 0; 개별 역할 대조 |
| 194 | `conditional_medical_expense::conditional.medical.service_kind` | 1 / medical_expense_evidence | text_or_enum / not_applicable | not_applicable / household_member | 등록·승인전 | typed 0; 미선언(source-only 후보); token 0; exact law 0; 기간 과잉후보(P2) |
| 195 | `conditional_nonstandard_income_or_household_event::conditional.change.affected_person` | 5 / employment_history, medical_expense_evidence, closure_certificate, divorce_records, income_household_change_evidence | party_role / not_applicable | not_applicable / applicant_debtor | 등록·승인전 | typed 0; 미선언(source-only 후보); token 0; exact law 0; 기간 과잉후보(P2) |
| 196 | `conditional_nonstandard_income_or_household_event::conditional.change.duration_end` | 5 / employment_history, medical_expense_evidence, closure_certificate, divorce_records, income_household_change_evidence | date / not_applicable | effective_date / applicant_debtor | 등록·승인전 | typed 0; 미선언(source-only 후보); token 0; exact law 0; 개별 역할 대조 |
| 197 | `conditional_nonstandard_income_or_household_event::conditional.change.effective_date` | 5 / employment_history, medical_expense_evidence, closure_certificate, divorce_records, income_household_change_evidence | date / not_applicable | effective_date / applicant_debtor | 등록·승인전 | typed 0; 미선언(source-only 후보); token 0; exact law 0; 개별 역할 대조 |
| 198 | `conditional_nonstandard_income_or_household_event::conditional.change.event_date` | 5 / employment_history, medical_expense_evidence, closure_certificate, divorce_records, income_household_change_evidence | date / not_applicable | event_date / applicant_debtor | 등록·승인전 | typed 0; 미선언(source-only 후보); token 0; exact law 0; 개별 역할 대조 |
| 199 | `conditional_nonstandard_income_or_household_event::conditional.change.event_kind` | 5 / employment_history, medical_expense_evidence, closure_certificate, divorce_records, income_household_change_evidence | enum_or_text / not_applicable | event_date / applicant_debtor | 등록·승인전 | typed 0; 미선언(source-only 후보); token 0; exact law 0; 개별 역할 대조 |
| 200 | `conditional_nonstandard_income_or_household_event::conditional.change.expense_delta` | 5 / employment_history, medical_expense_evidence, closure_certificate, divorce_records, income_household_change_evidence | money / KRW | period_scope / applicant_debtor | 등록·승인전 | typed 0; 미선언(source-only 후보); token 0; exact law 0; 개별 역할 대조 |

## 3. 코드 소비처·결함 후보의 독립 대조
1. **P1 영향 가능성이 있는 P2 기간 메타데이터 불일치 후보 6건**: 실제 `lib/feature-lineage-audit.ts` `hasPeriod(role,family)`는 역할이 `not_applicable`이더라도 family 명칭의 `education|medical|income`으로 true 판정. 신원/관계/기관/진료분류 6필드에 과잉 `periodIdentity` 선언. `evaluateCaseFieldLineage()`는 사람이 검토한 requirement가 존재하고 해당 source fact의 기간 표기가 없으면 `REQUIRED_FIELD_PERIOD_UNSCOPED` 후보를 추가한다. **코드 분기 정적 확인 + 원본 predicate 40회 격리 실행**만; 실사건의 false-block·법원 오류 미재현. 기존 [Draft PR #51](https://github.com/firmengine/firmengine/pull/51) 열린 상태, 같은 파일 수정 중인 PR #22/#26/#30과 통합 회귀/담당자 판단 전 병합 금지.
2. **#189 의료비 실제 지출**은 `material-calculation-source-gate.ts`의 `context_only`/destination=null. #184 청구금액, #187 미래 추정 반복비용, #189 실지급, #192 환급, #182 교육보조금, #200 가구 지출변화는 동일 의미/동일 시점/동일 대상 금액이 아니다. 원화 직접 합산·월환산·법원 인정 생계비 승격 금지. 실지급 증거, 제3자 부담, 지급자, 진료기간, 수혜자, 지원금·보험환급, 현행 법원 재량조건에 대한 역질문·증빙 검산 필요.
3. `canonical-field-binding.ts`의 `projections`에 이번 세 family의 직접 typed 매핑은 **없음**, `ocr-chain-matrix.ts` `OCR_DECLARED_FORM_TARGETS`에도 20 ID 정확 token **없음**. `reference-decision-tables.json` 실제 최신 선언 **18 계산 / 91 입력**을 개수 검산했지만, 선언 없는 OCR을 유사명칭으로 계산에 자동 연결하지 않았다. 의료비·교육비 원천을 중복 공제할 수 없고 별도 검증된 Fact/typed/사람 승인 없이 최종 월 변제액 계산·서식값 인수 불가.
4. `risk-catalog.json` 95개 `required_features`, `legal-catalog.json` 50개 `required_features`, `legal-exceptions.json` 46개 `features`의 **정확 canonical ID 조회 결과 0/20**. family/서류 기반 업무위험 후보가 있어도 승인된 증거계약이나 서울법원 재량 인정을 추론할 수 없다.
5. 갈음·법원보정: 전 회차의 문서요구/보정 수기 인계 경로만 계약상 확인. 이번 6개 서류에서 실제 B+C 갈음 결재, 수리·법원 보정명령 요청과 canonical 필드별 승인 소비처는 관찰하지 않았다. 누락 시 발급기관·대상자·기간·액수별 역질문, 사람 승인 없이 `not_applicable` 승격 금지.

## 4. A3 통합보드 체크 5개 — 부분 영수증(완료 아님)
- `A3-AX-013`: source-only 의료비·교육비를 계산/완성서식으로 자동 승격할 직접 binding이 없음을 정적 확인; 실제 writer·API final gate 미실행. [ ].
- `A3-DOC-018`: 관계/교육지원/진료/지급·환급/사건변동 20ID·44라우트의 대상·기간 역질문 필요 분리, 실제 서류요구·재요청 UI/갈음·법원보정 미인증. [ ].
- `A3-CALC-009`: 18/91 선언 조회, #189 context_only·destination=null을 대조하고 청구/환급/미래비용 차이 확인. 실제 월 추가생계비 및 가족수/법원 재량 산식 E2E 미실행. [ ].
- `A3-DATA-018`: 20개 명시 temporal role과 본문 hasPeriod/hasUnit 40회 대조, 6개 과잉 플래그 재현. 실제 Node/D1·여러 구성원/월 기간 실증 없음. [ ].
- `A3-LAW-008`: 95/50/46 기준 JSON에서 20 정확 ID 계약 0개, 적용조건 20개는 **case conditional/승인전**. 변호사 법률인정 및 법원 공식 판단 미실행. [ ].

**다음 시작 ID #201** (재감사 대상 #201~220), 다음 첫 역할 **IT담당자**. 최초 693/693 정적 열거와 심층 재감사 200/693은 각각 계약 커버리지이지 제품 인수 완료가 아니다. A3 보드 **0/124 최종 완료** 유지.

## 5. 원본 blob SHA (조회 snapshot)
| source | blob SHA |
|---|---|
| `lib/canonical-field-id-index.json` | `27ecdddd208de82a2f5c675e7482485e3a8838c2` |
| `lib/document-agent-field-contracts.json` | `9884b3fecf44643fefcdc4a421ed66ffc5477b3a` |
| `lib/shared-document-field-contracts.json` | `9decab974e0909ae24ad927bdfe241d75b71f3a9` |
| `lib/ocr-field-supplements.json` | `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5` |
| `lib/field-applicability-contracts.json` | `6076b26f782c4643a21a7b2f1a8f6261bb588b68` |
| `lib/canonical-field-binding.ts` | `60ee5c7762d52b72a165b4f4f8214680eb98f148` |
| `lib/feature-lineage-audit.ts` | `de81bc3b8c460b8a4dde3fda9e13087e619e74ff` |
| `lib/ocr-chain-matrix.ts` | `977de86ba698bd805cc6b95d1384e3b49d0dbb4c` |
| `lib/material-calculation-source-gate.ts` | `0286b44484913b63fa8ec3f7bf0ca59b034d0dab` |
| `lib/risk-catalog.json` | `e96dd0926e3ae9be5a5573d4551538ba294c4d2e` |
| `lib/legal-catalog.json` | `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e` |
| `lib/legal-exceptions.json` | `6e51197226bfd8320e1147d8df3f12c11e00927c` |
| `lib/reference-decision-tables.json` | `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` |
