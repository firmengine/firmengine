# FirmEngine A3 r44 — canonical #161~180 소비처 심층 재감사 (2026-11-01 KST)

## 1. 근거·검증 수준
기준 main SHA: 02afd20b906e93691a65f99d08b306ed86816c3a. 직전 r43 #141~160, 이전 r09 #161~180, 중앙 보드 A3 124체크를 인계. 최근 커밋/PR 확인: Draft PR #48(법원 원문) 및 #51(기간 과잉)은 미병합. 역할 순환: 사용자·서류담당자 → 변호사 → 데이터담당자 → 계산사무장 → IT담당자. 인수 완료 체크 0, 이번 5 ID도 미완료.
검증은 GitHub 고정 main 파일의 JSON 구조 조인, 원본 hasPeriod/hasUnit 식의 V8 격리실행, 코드/기존 테스트 정적 검토에 한정. 실제 OCR/PDF·D1 Fact/typed·Node 전체 CI·R2/Cron·공식 서식·변호사 승인·운영배포·전자제출 미실행. 개인 자료·키·OCR 사실값 없음.

## 2. 실제 입력·독립 기대·관찰
| 항목 | 기대·실제 관찰 | 인증층 |
|---|---|---|
| 693개 번호/원천 | 최신 canonical 693, 번호등록표 693 일치(이전 전체 비교 실행), 85문서/48패밀리/1808 선언 라우트 | 정적 인덱스·계약 |
| 이번 ID·source | 20 ID, 30 원천 슬롯, 4 문서 | 등록 후보이지 실 OCR 행 아님 |
| anchor·행/결측 상태 | 30/30 source locator, 누락·상충, noCrossRecordBorrowing/sourceOnly 정책 확인 | 선언만·실제 PDF 재독 없음 |
| 적용조건 | 19/20 정확 등록, #161 미등록·개별 합격 0% | 법률상 필수/승인 불명 |
| 소비처 | 직접 typed 0/20, 직접 form token 0/20, must_reconcile 0, #177 context_only 1, 승인된 정확 법률 evidence seed 0 | 계산/서식/법률 E2E 아님 |
| 원본 술어 | hasPeriod 30회·hasUnit 30회 V8 실행; temporal not_applicable인데 기간 true 4회(#175/178/179/180) | 기간 의미 불일치 후보 |
| 기준 규모 | 계산 18/입력 91, 법률위험95/규칙50/예외46 최신 JSON 확인 | 등록 규모만 |

## 3. 정확 20개 ID별 정적 원천·대상·기간·소비처/공백
원천 슬롯은 실제 인식된 페이지/복수행/저장 Fact 개수를 뜻하지 않는다. 문서·페이지·해시·row ordinal·기간·대상·원단위가 실제 연결되는지 별도 확인 필요. 미관찰/null/0/비해당/상충/source-only/승인전은 독립 상태이며 직접 소비처 0은 삭제 이유가 아니다.

| # | canonical ID | 슬롯/서류/family | datatype/원단위 | 기간/대상 | 정확 적용조건 | 소비처 및 후속 검토 |
|---:|---|---|---|---|---|---|
| 161 | cash_holding_statement::storage_location | 1 / cash_holding_statement / cash_deposit_asset | string / not_applicable | not_applicable / document_subject | 미등록 0% | typed 0; source_only; direct token 0; 정적 법률승인 0; 현금보관 위치·중복자산 확인 |
| 162 | conditional_case_specific_request::conditional.court_request.case_number | 2 / court_correction_order, case_specific_court_request / conditional_case_specific_request | string / not_applicable | not_applicable / court | 등록·승인전 | typed 0; source_only; direct token 0; 정적 법률승인 0; 법원 사건번호 cross-check |
| 163 | conditional_case_specific_request::conditional.court_request.court | 2 / court_correction_order, case_specific_court_request / conditional_case_specific_request | party_role / not_applicable | not_applicable / court | 등록·승인전 | typed 0; source_only; direct token 0; 정적 법률승인 0; 발령법원·관할 확인 |
| 164 | conditional_case_specific_request::conditional.court_request.item_due | 2 / court_correction_order, case_specific_court_request / conditional_case_specific_request | text_or_enum / not_applicable | not_applicable / applicant_debtor | 등록·승인전 | typed 0; source_only; direct token 0; 정적 법률승인 0; 요구항목·실제 발령 대조 |
| 165 | conditional_case_specific_request::conditional.court_request.legal_citation | 2 / court_correction_order, case_specific_court_request / conditional_case_specific_request | string / not_applicable | not_applicable / authority | 등록·승인전 | typed 0; source_only; direct token 0; 정적 법률승인 0; 법령근거·시행일 검토 |
| 166 | conditional_case_specific_request::conditional.court_request.operative_text | 2 / court_correction_order, case_specific_court_request / conditional_case_specific_request | text / not_applicable | not_applicable / court | 등록·승인전 | typed 0; source_only; direct token 0; 정적 법률승인 0; 명령원문·정확페이지 앵커 P1(PR48) |
| 167 | conditional_case_specific_request::conditional.court_request.request_type | 2 / court_correction_order, case_specific_court_request / conditional_case_specific_request | enum / not_applicable | not_applicable / court | 등록·승인전 | typed 0; source_only; direct token 0; 정적 법률승인 0; 명령·권고·요청 구분 |
| 168 | conditional_case_specific_request::conditional.court_request.response_deadline | 2 / court_correction_order, case_specific_court_request / conditional_case_specific_request | date / not_applicable | due_date / applicant_debtor | 등록·승인전 | typed 0; source_only; direct token 0; 정적 법률승인 0; 응답기한·독립 검증된 Fact 필요 |
| 169 | conditional_case_specific_request::conditional.court_request.response_filed_at | 2 / court_correction_order, case_specific_court_request / conditional_case_specific_request | datetime / not_applicable | event_date / applicant_debtor | 등록·승인전 | typed 0; source_only; direct token 0; 정적 법률승인 0; 회신시각·접수증 별개 |
| 170 | conditional_case_specific_request::conditional.court_request.service_date | 2 / court_correction_order, case_specific_court_request / conditional_case_specific_request | date / not_applicable | service_date / applicant_debtor | 등록·승인전 | typed 0; source_only; direct token 0; 정적 법률승인 0; 송달일·기한 기산 별개 |
| 171 | conditional_case_specific_request::conditional.court_request.status_change | 2 / court_correction_order, case_specific_court_request / conditional_case_specific_request | text_or_enum / not_applicable | event_date / court | 등록·승인전 | typed 0; source_only; direct token 0; 정적 법률승인 0; 상태문구·법원 효력 별개 |
| 172 | conditional_education_childcare::conditional.education.billed_amount | 1 / education_expense_evidence / conditional_education_childcare | money / KRW | period_scope / household_member | 등록·승인전 | typed 0; source_only; direct token 0; 정적 법률승인 0; 청구금액 ≠ 실제 지급 |
| 173 | conditional_education_childcare::conditional.education.enrollment_end | 1 / education_expense_evidence / conditional_education_childcare | date / not_applicable | statement_period_end / household_member | 등록·승인전 | typed 0; source_only; direct token 0; 정적 법률승인 0; 재학 종료·대상/기간 |
| 174 | conditional_education_childcare::conditional.education.enrollment_start | 1 / education_expense_evidence / conditional_education_childcare | date / not_applicable | statement_period_start / household_member | 등록·승인전 | typed 0; source_only; direct token 0; 정적 법률승인 0; 재학 시작·부분월 |
| 175 | conditional_education_childcare::conditional.education.fee_type | 1 / education_expense_evidence / conditional_education_childcare | enum_or_text / not_applicable | not_applicable / household_member | 등록·승인전 | typed 0; source_only; direct token 0; 정적 법률승인 0; 비용유형의 기간 과잉(P2) |
| 176 | conditional_education_childcare::conditional.education.frequency | 1 / education_expense_evidence / conditional_education_childcare | enum / not_applicable | period_scope / household_member | 등록·승인전 | typed 0; source_only; direct token 0; 정적 법률승인 0; 지출빈도·월환산 보류 |
| 177 | conditional_education_childcare::conditional.education.paid_amount | 1 / education_expense_evidence / conditional_education_childcare | money / KRW | event_date / applicant_debtor | 등록·승인전 | typed 0; context_only; direct token 0; 정적 법률승인 0; 실지급액 context_only·중복공제 금지 |
| 178 | conditional_education_childcare::conditional.education.payer | 1 / education_expense_evidence / conditional_education_childcare | party_role / not_applicable | not_applicable / payer | 등록·승인전 | typed 0; source_only; direct token 0; 정적 법률승인 0; 실지급자·기간 과잉(P2) |
| 179 | conditional_education_childcare::conditional.education.provider | 1 / education_expense_evidence / conditional_education_childcare | party_role / not_applicable | not_applicable / issuer | 등록·승인전 | typed 0; source_only; direct token 0; 정적 법률승인 0; 제공기관·기간 과잉(P2) |
| 180 | conditional_education_childcare::conditional.education.recipient | 1 / education_expense_evidence / conditional_education_childcare | party_role / not_applicable | not_applicable / household_member | 등록·승인전 | typed 0; source_only; direct token 0; 정적 법률승인 0; 수혜자·기간 과잉(P2) |

## 4. 발견 및 기존 수정안
1. P2 #161 cash_holding_statement::storage_location: 원천확장 존재·적용조건 미등록. sourceCondition=null 후보. 승인 전 합격 0%; 자동 삭제·법률 필수요건 등록 금지.
2. P2 #175·#178·#179·#180: family education 문자열 때문에 개별 시간역할 not_applicable 필드도 hasPeriod true. 문서 전체 기간과 사람·비용분류 필드 분리. Draft PR #51은 개선 후보(미병합), 운영 OCR 실패 미재현.
3. 기존 P1 #166: 현재 preapproval-correction-item-store.ts는 활성 법원 PDF·페이지·인용문 길이를 확인하지만 같은 페이지 실제 인용문 대조는 미구현. Draft PR #48 미병합. 실제 법률 오류 발생 단정 금지.
4. #177: material calculation source 계약의 destination=null, policy=context_only. 청구액 #172·지원금·지급자·수혜자·지출빈도와 검산; 자동 월환산·중복공제/인정 금지.
5. 법원보정/갈음은 source-bound 수기 requiredCanonicalFieldIds, 별도 검증된 기한 Fact, 문서요구·갈음 범용 검토 경로로만 확인. 각 ID별 실제 법원보정·B+C 갈음·수리/접수증·법률상 승인 미관찰.

## 5. 중앙 보드 5개 ID 부분 진행 (모두 [ ] 유지)
- A3-DOC-017: 교육비 청구/실지급, 수집/인정/제출 분리; 실제 OCR·법원 접수 미인증.
- A3-LAW-013: #162~171 법원명령/송달/기한/quote 페이지 앵커, PR48 미병합·변호사 미승인.
- A3-DATA-016: 20개 ID/30 원천 계약과 수기 보정 필드 참조 확인, D1 고아 참조 미실험.
- A3-CALC-015: #172 billed vs #177 paid context_only, 지원금/제3자/빈도 이중계상 검토, 18계산 E2E 미실험.
- A3-IT-004: 95 위험·50 규칙·46 예외의 정확 canonical 승인 계약은 이 범위에서 미인증; 운영 관리형 정책 미조회.

다음 시작 #181~200, 다음 첫 역할 AX담당자. 최초 순차 정적 조사 693/693, 심층 재감사 180/693(계약/술어 수준, 전체 인수 아님). A3 최종 인수 완료 0/124. 운영 배포/운영 D1 migration/법원 전자제출/인가 확정 미수행.

## 6. 고정 snapshot 실제 소스 SHA
- lib/canonical-field-id-index.json : 27ecdddd208de82a2f5c675e7482485e3a8838c2
- lib/document-agent-field-contracts.json : 9884b3fecf44643fefcdc4a421ed66ffc5477b3a
- lib/shared-document-field-contracts.json : 9decab974e0909ae24ad927bdfe241d75b71f3a9
- lib/ocr-field-supplements.json : 63b2bf853acb2e9620a6fb72377dc278ff3cd2a5
- lib/field-applicability-contracts.json : 6076b26f782c4643a21a7b2f1a8f6261bb588b68
- lib/feature-lineage-audit.ts : de81bc3b8c460b8a4dde3fda9e13087e619e74ff
- lib/material-calculation-source-gate.ts : 0286b44484913b63fa8ec3f7bf0ca59b034d0dab
