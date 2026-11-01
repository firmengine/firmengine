# FirmEngine A3 r62 — canonical OCR #521–540 소비처 심층 재감사 (2026-11-02 KST)

## 읽은 판본·수행 경계

- 감사 시작 직전 실제 GitHub `main` SHA: `e708db2ba4dcf0117096de89646e87ee2a754df5`. 허용 범위 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래만. 이전 r61 영수증 `20261102-r61-canonical-501-520-consumer-recheck-0130KST.md`에서 이어받음.
- 기존 r27 `20261031-r27-canonical-521-540-1522KST.md` 원본 초기 감사와 중복 비교. 기존 Draft PR #149(법원 보정기한 ID 상충), #51(기간검사)을 덮어쓰지 않음. 새 제품 코드 수정 없음.
- 실제 read: `canonical-field-id-index.json`, `document-agent-field-contracts.json`, `shared-document-field-contracts.json`, `ocr-field-supplements.json`, `field-applicability-contracts.json`, `reference-intake-catalog.json`, `reference-decision-tables.json`, `risk-catalog.json`, `legal-catalog.json`, `legal-exceptions.json`; `feature-lineage-audit.ts`, `assessment.ts`, `canonical-field-binding.ts`, `material-calculation-source-gate.ts`, `ocr-chain-matrix.ts`, `db/schema.ts`; 기존 `tests/feature-lineage-audit.test.ts`·`tests/calculation-input-audit.test.ts` 및 이전 영수증.
- 최신 선언 규모: canonical **693고유**, 문서 **85**, OCR 패밀리 **48**, 문서×패밀리 **141라우트**, 필드 원천 선언 **1,808슬롯**. 계산 **18개 / 선언 입력91회**, 법률위험 **95**, 규칙 **50**, 예외 **46**. 실제 OCR·D1 데이터의 개수 또는 제품 인수율이 아님.
- 이번 **20개 canonical / 42개 원천 슬롯 / 4개 문서 / 2개 패밀리**. L=`litigation_record@procedure_enforcement_garnishment`(9슬롯), P/C/A=`prior_case_records`/`prior_creditor_list`/`private_adjustment_records` 각각 `@procedure_prior_insolvency`(11×3=33슬롯). 문서/페이지/행/대상/기간/증거 SHA는 계약에서 필수이나 **실제 값은 미관찰**.

## 최신 index 원본 순서 #521–540, 증거/계산/법률/양식 소비처

P/U는 **원본 `hasPeriod()`/`hasUnit()` 함수의 true 판정 슬롯 수**. source-only는 원문보존·검산·역질문·갈음/법원보정 재검토 후보이고 **무용, 0원 또는 자동승인이 아님**.

| # | canonical ID | 원천 문서(슬롯) | datatype / original unit | 주체 / temporal role | P/U | sourceCondition | 증거 외 직접 소비처 |
|---:|---|---|---|---|---:|---|---|
| 521 | `procedure_enforcement_garnishment::procedure.enforcement.claimed_amount` | L (1) | `money` / `KRW` | `creditor` / `source_as_of_date` | 1/1 | 등록 | source-only, 직접 typed/계산/토큰·승인 법률계약 없음 |
| 522 | `procedure_enforcement_garnishment::procedure.enforcement.creditor` | L (1) | `party_role` / `not_applicable` | `creditor` / `not_applicable` | 0/0 | 등록 | source-only, 직접 typed/계산/토큰·승인 법률계약 없음 |
| 523 | `procedure_enforcement_garnishment::procedure.enforcement.debtor` | L (1) | `party_role` / `not_applicable` | `applicant_debtor` / `not_applicable` | 0/0 | 등록 | source-only, 직접 typed/계산/토큰·승인 법률계약 없음 |
| 524 | `procedure_enforcement_garnishment::procedure.enforcement.effective_date` | L (1) | `date` / `not_applicable` | `court` / `effective_date` | 1/0 | 등록 | source-only, 직접 typed/계산/토큰·승인 법률계약 없음 |
| 525 | `procedure_enforcement_garnishment::procedure.enforcement.order_date` | L (1) | `date` / `not_applicable` | `court` / `event_date` | 1/0 | 등록 | source-only, 직접 typed/계산/토큰·승인 법률계약 없음 |
| 526 | `procedure_enforcement_garnishment::procedure.enforcement.order_type` | L (1) | `enum` / `not_applicable` | `court` / `not_applicable` | 0/0 | 등록 | source-only, 직접 typed/계산/토큰·승인 법률계약 없음 |
| 527 | `procedure_enforcement_garnishment::procedure.enforcement.released_amount` | L (1) | `money` / `KRW` | `applicant_debtor` / `event_date` | 1/1 | 등록 | source-only, 직접 typed/계산/토큰·승인 법률계약 없음 |
| 528 | `procedure_enforcement_garnishment::procedure.enforcement.service_date` | L (1) | `date` / `not_applicable` | `applicant_debtor` / `service_date` | 1/0 | 등록 | source-only, 직접 typed/계산/토큰·승인 법률계약 없음 |
| 529 | `procedure_enforcement_garnishment::procedure.enforcement.status` | L (1) | `enum` / `not_applicable` | `court` / `record_as_of_date` | 1/0 | 등록 | source-only, 직접 typed/계산/토큰·승인 법률계약 없음 |
| 530 | `procedure_prior_insolvency::procedure.history.case_number` | P,C,A (3) | `string` / `not_applicable` | `court` / `not_applicable` | 0/0 | 등록 | source-only, 직접 typed/계산/토큰·승인 법률계약 없음 |
| 531 | `procedure_prior_insolvency::procedure.history.case_type` | P,C,A (3) | `enum` / `not_applicable` | `applicant_debtor` / `not_applicable` | 0/0 | 등록 | source-only, 직접 typed/계산/토큰·승인 법률계약 없음 |
| 532 | `procedure_prior_insolvency::procedure.history.court_authority` | P,C,A (3) | `party_role` / `not_applicable` | `court` / `not_applicable` | 0/0 | 등록 | source-only, 직접 typed/계산/토큰·승인 법률계약 없음 |
| 533 | `procedure_prior_insolvency::procedure.history.debtor` | P,C,A (3) | `party_role` / `not_applicable` | `applicant_debtor` / `not_applicable` | 0/0 | 등록 | source-only, 직접 typed/계산/토큰·승인 법률계약 없음 |
| 534 | `procedure_prior_insolvency::procedure.history.discharge_date` | P,C,A (3) | `date` / `not_applicable` | `applicant_debtor` / `discharge_effective_date` | 3/0 | 등록 | source-only, 직접 typed/계산/토큰·승인 법률계약 없음 |
| 535 | `procedure_prior_insolvency::procedure.history.filing_date` | P,C,A (3) | `date` / `not_applicable` | `applicant_debtor` / `application_filing_date` | 3/0 | 등록 | source-only, 직접 typed/계산/토큰·승인 법률계약 없음 |
| 536 | `procedure_prior_insolvency::procedure.history.finality_date` | P,C,A (3) | `date` / `not_applicable` | `court` / `effective_date` | 3/0 | 등록 | source-only, 직접 typed/계산/토큰·승인 법률계약 없음 |
| 537 | `procedure_prior_insolvency::procedure.history.order_date` | P,C,A (3) | `date` / `not_applicable` | `court` / `event_date` | 3/0 | 등록 | source-only, 직접 typed/계산/토큰·승인 법률계약 없음 |
| 538 | `procedure_prior_insolvency::procedure.history.order_kind` | P,C,A (3) | `enum_or_text` / `not_applicable` | `court` / `not_applicable` | 0/0 | 등록 | source-only, 직접 typed/계산/토큰·승인 법률계약 없음 |
| 539 | `procedure_prior_insolvency::procedure.history.private_adjustment_attempt` | P,C,A (3) | `enum` / `not_applicable` | `applicant_debtor` / `not_applicable` | 0/0 | 등록 | source-only, 직접 typed/계산/토큰·승인 법률계약 없음 |
| 540 | `procedure_prior_insolvency::procedure.history.record_issue_date` | P,C,A (3) | `date` / `not_applicable` | `court` / `document_issue_date` | 3/0 | 등록 | source-only, 직접 typed/계산/토큰·승인 법률계약 없음 |

- 정확한 `sourceCondition`: **20/20 등록**; 실제 법원 요건승인과 별개. `source_locator_required`는 **boolean이 아닌 {document_id,document_sha256,page,quote,bbox,...} 객체**. 42/42 슬롯에서 요구문서·원본 SHA·페이지 locator 선언 확인. `recordPolicy.noCrossRecordBorrowing/sourceOnly`도 42/42. 원문값·페이지·행·SHA·상충 증거의 실제 존재는 미검증.
- DB 원문 경로: `db/schema.ts`의 `extraction_records` / `extracted_features` / `extraction_field_coverage`, `extraction-row-store.ts`의 page/run/fact 포인터 경유; **이번 범위 개별 ID의 typed projection 직접 선언 0/20**, `MATERIAL_CALCULATION_SOURCES` 정확 등록 0/20, 계산 18/91과 정확 직접 OCR 입력 연결 0/20.
- 법률: 위험95/규칙50/예외46의 **정확 canonical 승인 증거계약 0/20**(정적 원천/seed 기준), `legal-evidence-criteria.ts`의 seed checks=[]; 런타임 운영 기준정보/승인 로그는 미조회. 참고용 `KR-PR-008`은 과거 면책효력 시점, `KR-PR-009`는 과거 절차 신청/관련문서로 **사건 수준 입력 이름**이 따로 존재하지만 #534/#535와 정확 OCR Fact→법률 증거 계약은 확인되지 않음. 법률요건 미등록/미승인 **합격 0%**, 사람 검토 필요.
- 서식: `OCR_DECLARED_FORM_TARGETS` 정확 token **0/20**. 실제 `reviewScope` 원본 함수 결과 L=[`D5100,D5105,D5106,D5110`], P/C/A=[`D5100,D5105`]; **family regex 기반 서식 검토 후보**이지 원본 피처→공식 법원 양식 토큰이나 승인 전자제출 아님.
- 갈음: `approve-document-substitution.ts`의 발급곤란·대체증거(B+C) 직원 승인 경계는 사건별 대안 적용·승인 증빙 미검증. 법원보정: `preapproval-correction-item-store.ts`의 법원원문/기한 Fact 검증 후보와 해당 #521–540 source ID의 **직접 항목화·법원 접수 확인 없음**. 기존 #507 P1 Draft PR #149는 별도 미병합.

## 실제 실행한 독립 테스트·기대값·관측

| 방식/입력 | 독립 기대 | 실제 관찰 | 판정 |
|---|---|---|---|
| 원본 index 693 × 85문서 ×48 family 및 base+extension+supplement 전수 정적 조인 | 693고유, 141 route, 1,808 슬롯; 이번 L 9 + P/C/A 33 | **일치** | JSON 정적 계약 실행. 원문 OCR 미실행 |
| #521–540의 각 field 원천슬롯 수·locator 객체·복수행 정책·sourceCondition·타입/단위/role 정체성 | 20ID/42slot, 조건 20등록, 42 원천앵커 요구, 의미 충돌0 | **84/84 정적 단언 일치** | V8 JS 실행, 실제 D1 저장 아님 |
| 원본 `hasPeriod` 42 슬롯 + `hasUnit` 42 슬롯 | 기간21/42, 단위2/42 | **84회 호출, 21/2** | TypeScript 타입 주석만 제거한 함수식 V8 격리 |
| typed/material/정확 서식 토큰/법률 증거계약 정적 대조 | 직접 typed0/material0/form0/승인 법률0 | **각 0/20**, 빈 소비처를 폐기하지 않음 | 정적 정확 ID·family 매칭 |
| `reviewScope` 원본 V8 함수본문에 family 2종 입력 | L=D5100,5105,5106,5110; P=D5100,5105 | **2/2 일치** | 단순 서식검토 후보 |
| `assessment.ts` 원본 eligibility 루프를 타입주석만 제거해 합성 context 7건 | 미설정/unknown/no → 과거절차 review_required; yes → 해당 finding 없음, 기타 자연인=no 별도 fail | **7/7 기대 분기 일치** | 루프 격리. 실법률 판단·전체 assessment/E2E 아님 |

감사 코드 최초 locator 점검에서 객체를 `true`와 비교해 생긴 **감사 도구의 거짓 실패**는 실제 JSON 필드형을 확인해 객체 속성 검증으로 교정 후 재실행(84/84). 제품 결함으로 집계하거나 계약을 수정하지 않음.

## 발견·남은 위험 (모두 사람 승인 전)

1. **P2 재확인 — 과거 절차 법률검토 경고의 source Fact 비결속:** `assessment.ts`에서 담당자 context `priorProceedingsReviewed="yes"`만으로 과거 절차의 해당 review finding 1건이 생략됨. 원본 함수 루프에 #534 면책효력일/#535 신청일/#536 확정일/#537 결정일/#540 문서발급일 Fact 조회 없음. 기존 r27 후보의 재현이며 **전체 적격성 자동합격/법원인가를 입증하지 않음**. KR-PR-008(5년 검토)·009(10년 자료)의 적용판본·법률 근거·법원/변호사 검증 후 별도 PR 검토. main 의미 변경 금지.
2. **P2 — 집행청구·압류·해제액의 무단 산술 위험:** #521 청구액, 직전 #518 압류액, #527 해제액은 대상/권리자/기준일/처분행위가 달라 서로 빼서 채무원금·가용재산·변제액으로 산정하면 안 됨. #529 active/lifted/status도 기준일·공식명령 검토 전 법률상 집행종료 확정 금지.
3. **P2 — 과거 절차 3문서 ID 공용/사건 동일성 검토:** #530~540의 동일 canonical 11개가 P/C/A 문서에 총33개 슬롯으로 등장. 법원/사건번호/원본문서 SHA/당사자/행을 분리하고 같은 사건 재등장은 정합 검토; 3배 사실·날짜로 취급 금지. 날짜 #534/#535/#536/#537/#540의 법률적 역할 엄격 구분.
4. **0개 직접 계산/서식/승인 법률계약은 자동 폐기 사유가 아니다.** 증거보존·증빙 요구·역질문·갈음·법원보정 가능성은 사람확인 큐로 유지한다.

## A3 보드 5역할 체크 ID (모두 부분검증만, `[ ]` 유지)

- **AX `A3-AX-020`**: #521–540 20 ID의 원천 전용/승인전 경계를 정적 확인. 기준정보 용도등록·사건별 적용 승인 미확인.
- **IT `A3-IT-002`**: 증거/typed/계산/법률·서식·갈음·보정의 정확 ID 경로 및 공백 독립 대조, 20×42슬롯. 실제 사용자/DB 워크플로 미관찰.
- **사용자·서류 `A3-DOC-005`**: 집행 9 ID·과거 절차 11 ID의 문서4종·대상/일자/복수행 증빙 요구, 갈음/법원보정 실제 승인·접수 미확인.
- **계산사무장 `A3-CALC-018`**: #521/#518/#527 청구/압류/해제와 과거 기록 관련 금액을 자동 산술하지 않음; 실계산 안 함.
- **변호사 `A3-LAW-002`**: #534·535 등 priorProcedures / 법률 KR-PR-008·009 간 정확 Fact 증거계약 미연결, eligibility 루프 7/7 재현. 법률상 적격성 승인 금지.

역할 첫 담당 순환: r61 **데이터 → IT → 사용자·서류 → 계산사무장 → 변호사**, r62 **AX → IT → 사용자·서류 → 계산사무장 → 변호사**. 6역할 전체 순환의 해당 분절로서 AX/데이터를 교대로 먼저 검수함. 124개 A3 체크 ID 중 완료 `[x]` 0개.

## 후속 위치·금지사항

- 원본 canonical index 순서에 따른 심층 재감사 **540/693 = 77.9%**, 잔여 **153**. 다음 **#541–560**, 시작 **#541 `procedure_private_creditor_request::procedure.creditor_info... `의 실제 최신 인덱스 재조회**. 다음 담당 시작 **데이터담당자**.
- 실행/승인 미인증: 실제 문서·OCR 인식, page/row/sourceHash/CAS, D1/R2/Cron, 전체 Node CI, 18계산 E2E, 공식 법원 서식 출력, 변호사 서명·인수, 전자접수 및 사이트 운영배포. 미관찰/null/정확한0/명시없음/상충/source-only/승인전 구분. 개인 정보·원본 OCR 값·실고객 자료·env·키 공개 금지; 운영 DB 변경·이관·제출 안 함.

### 주요 원본 blob SHA
- `lib/canonical-field-id-index.json`: `27ecdddd208de82a2f5c675e7482485e3a8838c2`
- `lib/document-agent-field-contracts.json`: `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`
- `lib/ocr-field-supplements.json`: `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`
- `lib/field-applicability-contracts.json`: `6076b26f782c4643a21a7b2f1a8f6261bb588b68`
- `lib/feature-lineage-audit.ts`: `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`
- `lib/assessment.ts`: `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`
- `lib/canonical-field-binding.ts`: `60ee5c7762d52b72a165b4f4f8214680eb98f148`
- `lib/material-calculation-source-gate.ts`: `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`
- `lib/ocr-chain-matrix.ts`: `977de86ba698bd805cc6b95d1384e3b49d0dbb4c`
- `lib/reference-decision-tables.json`: `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`
- `lib/risk-catalog.json`: `e96dd0926e3ae9be5a5573d4551538ba294c4d2e`
- `lib/legal-catalog.json`: `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`
- `lib/legal-exceptions.json`: `6e51197226bfd8320e1147d8df3f12c11e00927c`
- `db/schema.ts`: `933f8686845ac14669312dd21bf85e02c62ed5e6`
