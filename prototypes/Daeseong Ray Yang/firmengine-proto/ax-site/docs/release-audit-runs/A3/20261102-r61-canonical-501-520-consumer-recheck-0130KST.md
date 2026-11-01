# FirmEngine AX A3 r61 — canonical OCR #501–520 증거·계산·법률·서식 소비처 전수 재감사 (2026-11-02 KST)

## 입력판본·이어받기·경계

- 이번 조회 GitHub `main` SHA: `c05d45b9a09f2ee3cb7458def3730541c08fc0c3`; 작업 허용 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만. 시작 직전 확인한 r60 영수증: `docs/release-audit-runs/A3/20261102-r60-canonical-481-500-consumer-recheck-0024KST.md`. 직전 진행 #481–500, 다음 **#501–520**.
- 최근 main 커밋/A1·A2·A4 PR 및 현행 원천 JSON/스키마/검증 함수/기존 `tests/feature-lineage-audit.test.ts`, `tests/preapproval-correction-item-store.test.ts`를 조사. 동시 에이전트의 Draft PR·코드는 덮어쓰지 않음.
- 현재 선언 계약을 원천 인덱스 순서로 독립 조인: **693 canonical(고유693), 85 서류, 48 추출 패밀리, 141 문서-family route, 1,808 source slot**, 위험95·법률규칙50·법률예외46, 계산18/선언입력91(고유경로78). 수치는 **정적 정의 규모**, 실제 서류 판독 수/실제 사용 건수가 아님.
- 이번 **20 ID / 20 slot / 3문서 / 3 OCR family**. 문서별: `pension_contribution_statement` 4, `court_correction_order` 12, `litigation_record` 4.
- 20/20의 OCR 원문 locator 계약 확인: **기본 field `source_locator_required` 16, 문서 확장 field `required_source_anchor` 4**. 20/20 문서의 `recordPolicy.noCrossRecordBorrowing=true`, `sourceOnly=true`. 문서 SHA·페이지·원문인용/이미지 bbox·행/대상/기간 분리 **정적 요구**이며 실제 저장값 관찰 아님.

## ID별 5층 소비처·남은 공백

**공통 정적 소비처:** `db/schema.ts`의 `extraction_records`(document/page/record ordinal) → `extracted_features`(canonical ID, 원문값, 상태, quote/bbox, subject/lineage) → `extraction_field_coverage`(미관찰) → 사건별 현재 Fact 검수 후보. 모든 20개의 **직접 `canonicalProjectionKey` typed 선언 0/20**, **18모듈 91입력 정확 연결 0/20**, `MATERIAL_CALCULATION_SOURCES` 직접 선언 0/20, `OCR_DECLARED_FORM_TARGETS` 정확 서식 token 0/20, 정적 위험95/규칙50/예외46 정확 canonical 필수근거 0/20, `LEGAL_EVIDENCE_POLICY_SEED.checks=[]` (운영 기준정보는 미조회). **적용조건 선언 16/20**. 검토 후보와 승인 기준을 혼동하지 말 것.

| # | canonical ID | 증빙 route (1 source slot) | 타입 / 원 단위 | 주체 / 시간 역할 | 정확 sourceCondition | 현재 소비 수준 |
|---:|---|---|---|---|---|---|
| 501 | `pension_contribution_statement::unpaid_amount` | `pension_contribution_statement@pension_contribution_benefit` | `money` / `KRW` | `document_subject` / `not_applicable` | **정확 조건 미등록(P2)** | 증거·검산·역질문 후보만; 직접 typed/계산/서식·승인법률 0 |
| 502 | `pension_contribution_statement::unpaid_months` | `pension_contribution_statement@pension_contribution_benefit` | `integer` / `month` | `document_subject` / `not_applicable` | **정확 조건 미등록(P2)** | 증거·검산·역질문 후보만; 직접 typed/계산/서식·승인법률 0 |
| 503 | `pension_contribution_statement::unpayable_amount` | `pension_contribution_statement@pension_contribution_benefit` | `money` / `KRW` | `document_subject` / `not_applicable` | **정확 조건 미등록(P2)** | 증거·검산·역질문 후보만; 직접 typed/계산/서식·승인법률 0 |
| 504 | `pension_contribution_statement::unpayable_months` | `pension_contribution_statement@pension_contribution_benefit` | `integer` / `month` | `document_subject` / `not_applicable` | **정확 조건 미등록(P2)** | 증거·검산·역질문 후보만; 직접 typed/계산/서식·승인법률 0 |
| 505 | `procedure_court_orders::procedure.order.case_number` | `court_correction_order@procedure_court_orders` | `string` / `not_applicable` | `court` / `not_applicable` | 선언 존재 | 증거·검산·역질문 후보만; 직접 typed/계산/서식·승인법률 0 |
| 506 | `procedure_court_orders::procedure.order.court` | `court_correction_order@procedure_court_orders` | `party_role` / `not_applicable` | `court` / `not_applicable` | 선언 존재 | 증거·검산·역질문 후보만; 직접 typed/계산/서식·승인법률 0 |
| 507 | `procedure_court_orders::procedure.order.deadline` | `court_correction_order@procedure_court_orders` | `date` / `not_applicable` | `applicant_debtor` / `due_date` | 선언 존재 | 증거·검산·역질문 후보만; 직접 typed/계산/서식·승인법률 0 |
| 508 | `procedure_court_orders::procedure.order.debtor` | `court_correction_order@procedure_court_orders` | `party_role` / `not_applicable` | `applicant_debtor` / `not_applicable` | 선언 존재 | 증거·검산·역질문 후보만; 직접 typed/계산/서식·승인법률 0 |
| 509 | `procedure_court_orders::procedure.order.effective_date` | `court_correction_order@procedure_court_orders` | `date` / `not_applicable` | `court` / `effective_date` | 선언 존재 | 증거·검산·역질문 후보만; 직접 typed/계산/서식·승인법률 0 |
| 510 | `procedure_court_orders::procedure.order.finality` | `court_correction_order@procedure_court_orders` | `enum_or_date` / `not_applicable` | `court` / `effective_date` | 선언 존재 | 증거·검산·역질문 후보만; 직접 typed/계산/서식·승인법률 0 |
| 511 | `procedure_court_orders::procedure.order.operative_text` | `court_correction_order@procedure_court_orders` | `text` / `not_applicable` | `court` / `not_applicable` | 선언 존재 | 증거·검산·역질문 후보만; 직접 typed/계산/서식·승인법률 0 |
| 512 | `procedure_court_orders::procedure.order.order_date` | `court_correction_order@procedure_court_orders` | `date` / `not_applicable` | `court` / `event_date` | 선언 존재 | 증거·검산·역질문 후보만; 직접 typed/계산/서식·승인법률 0 |
| 513 | `procedure_court_orders::procedure.order.order_type` | `court_correction_order@procedure_court_orders` | `enum_or_text` / `not_applicable` | `court` / `not_applicable` | 선언 존재 | 증거·검산·역질문 후보만; 직접 typed/계산/서식·승인법률 0 |
| 514 | `procedure_court_orders::procedure.order.scope` | `court_correction_order@procedure_court_orders` | `text_or_list` / `not_applicable` | `court` / `not_applicable` | 선언 존재 | 증거·검산·역질문 후보만; 직접 typed/계산/서식·승인법률 0 |
| 515 | `procedure_court_orders::procedure.order.service_date` | `court_correction_order@procedure_court_orders` | `date` / `not_applicable` | `applicant_debtor` / `service_date` | 선언 존재 | 증거·검산·역질문 후보만; 직접 typed/계산/서식·승인법률 0 |
| 516 | `procedure_court_orders::procedure.order.status_change` | `court_correction_order@procedure_court_orders` | `text_or_enum` / `not_applicable` | `court` / `event_date` | 선언 존재 | 증거·검산·역질문 후보만; 직접 typed/계산/서식·승인법률 0 |
| 517 | `procedure_enforcement_garnishment::procedure.enforcement.asset_or_income` | `litigation_record@procedure_enforcement_garnishment` | `enum_or_text` / `not_applicable` | `applicant_debtor` / `not_applicable` | 선언 존재 | 증거·검산·역질문 후보만; 직접 typed/계산/서식·승인법률 0 |
| 518 | `procedure_enforcement_garnishment::procedure.enforcement.attached_amount` | `litigation_record@procedure_enforcement_garnishment` | `money` / `KRW` | `applicant_debtor` / `source_as_of_date` | 선언 존재 | 증거·검산·역질문 후보만; 직접 typed/계산/서식·승인법률 0 |
| 519 | `procedure_enforcement_garnishment::procedure.enforcement.authority` | `litigation_record@procedure_enforcement_garnishment` | `party_role` / `not_applicable` | `court` / `not_applicable` | 선언 존재 | 증거·검산·역질문 후보만; 직접 typed/계산/서식·승인법률 0 |
| 520 | `procedure_enforcement_garnishment::procedure.enforcement.case_number` | `litigation_record@procedure_enforcement_garnishment` | `string` / `not_applicable` | `court` / `not_applicable` | 선언 존재 | 증거·검산·역질문 후보만; 직접 typed/계산/서식·승인법률 0 |

**실제 페이지·행·sourceHash/원문 내용:** 20개 모두 이번 회차에 실제 고객 PDF/D1를 사용하지 않았으므로 `not_observed`; 숫자 `0`, 법적 `not_applicable`, 법원 접수 `satisfied`로 대체하지 않음. 반환 가능 상태: `not_observed`/`null`/`0`/`explicit_none`/`conflict`/`source_only`/`unreviewed` 개별 상태를 유지.

## 실질 발견 / 직접 소비처와 구분

1. **P2: #501–504 확장 피처의 정확 적용조건 미등록 4건.** `pension_contribution_statement`의 `unpaid_amount`(미납금), `unpaid_months`(미납월수), `unpayable_amount`(납부불능액), `unpayable_months`(납부불능월수)는 문서의 원문표 속성·행·원단위가 존재하지만 `field-applicability-contracts.json:families.pension_contribution_benefit.fields`에서 정확 ID의 `sourceCondition`이 **null**. r60 #494–500 7건과 같은 확장그룹의 공백으로 누적 **11개(#494–504)**. 기재 근거 없이 자동 0/비해당/법률상 확정 처리 금지. 보정·갈음·서류 추가 요청 용도는 사람승인 필수.
2. **P1 Draft PR #149 — #507 법원 보정기한의 canonical 증거 정체성 불일치.** `preapproval-correction-item-store.ts::validateCorrectionItemDraft`는 현재 보정사건/문서·페이지/원문 인용/상태·구 legacy `court.correctionDeadline` 키를 검사하지만, **같은 키가 다른 명시 canonical ID(`...order.case_number`)를 가지더라도 기한 Fact으로 승인 경로를 통과**하는 사례를 원본 함수본문 V8 격리 입력으로 관찰. 독립 기대=`CORRECTION_DEADLINE_NOT_SOURCE_BOUND`, 실제 main=`pass` (**불일치 1**). Draft 브랜치 `audit/a3-r61-court-deadline-canonical-20261102`에 명시 canonical ID 불일치만 차단하는 보수적 패치와 회귀 테스트 추가. **draft PR <https://github.com/firmengine/firmengine/pull/149>, main 병합 금지/변호사·데이터·IT 검수 필요.** legacy Fact에 canonical ID가 없는 경우 현행 통과 행동은 유지; 앞으로 별도 정확 매핑 검토 필요. 운영/법원 승인이 아님.
3. **보정명령·압류증거의 계산/서식 혼합 금지.** `#505 case_number`, `#506 court`, `#507 deadline`, `#509 effective_date`, `#512 order_date`, `#515 service_date`는 별개 역할. **보정기한 vs 송달일/명령일** 자동 치환 불가. `#510 finality`의 법적 확정 상태는 원문 관찰만으로 확정 불가. `#518 attached_amount`는 `money/KRW`이나 현재 채무잔액·월변제액·보전재산에 **자동 금액 포함 금지**. `#501 unpaid_amount` 및 `#503 unpayable_amount`도 공적 체납액·납입액과 무단 합산 금지.
4. **검토 후보와 정확 서식 token 구분.** 실제 `reviewScope()` V8 함수본문 격리 결과 `pension_contribution_benefit` → forms=[`EVIDENCE_INDEX`], `procedure_court_orders` → [`D5100`,`D5105`], `procedure_enforcement_garnishment` → [`D5100`,`D5105`,`D5106`,`D5110`]. 이는 **family명 정규식 기반 review candidate**이며 #501–520의 정확 field-to-token 연결이나 법원 필수기재 인증이 아니다. `legal-evidence-criteria.ts`의 운영 승인형 계약은 DB 조회 전 미관찰. 위험95·규칙50·예외46의 정확 적용조건 **승인된 건 0**으로 처리.

## 실행한 테스트 / 독립 기대 vs 관찰

| 방식·입력 | 독립 기대 | 관찰 | 판정 수준 |
|---|---|---|---|
| 최신 index×85문서×48family×supplement static join | 693고유/85/48/141/1,808, #501–520 정확 20 slot·3문서·원문 locator 보존 | **모두 일치**, 중복/고아 0 | GitHub JSON 정적 조인, 실제 OCR 아님 |
| #501–520 20개 exact 적용조건 대조 | #501–504 4개는 미등록, 나머지16 등록 | **16/20**, 4개 미등록 | 선언 검증(4개 불합격, 법률승인 0%) |
| #501–520 direct typed/18계산91입력/material/정확 token/위험95·규칙50·예외46 | 정확 선언 0/20 | 각 범주 **0/20** | 소비처의 정확 선언 부재; 유용성 0으로 판정하지 않음 |
| `hasPeriod`/`hasUnit` 원본 술어 V8 구분(대표 5 family/role) | pension monetary true/true, court due date true/false, court text false/false, enforcement 금액 true/true, enforcement ID false/false | **5/5 기대 일치** | 추출 환경의 선언 술어, 실제 법적 요건 아님 |
| `reviewScope` 원본 V8 함수본문, family 3종 | EVIDENCE_INDEX / D5100+D5105 / D5100+D5105+D5106+D5110 | **3/3 기대 일치** | 서식/법률 '후보' 함수 |
| `validateCorrectionItemDraft` 원본 main 함수본문 (TypeScript 서명만 제거) + 합성 원문/Fact refs | 잘못된 **명시 canonical ID**는 거절, 올바른 ID·기타 위반은 각각 기대한 결과 | **6/7**, 틀린 명시 ID만 기대 거부→실제 `pass` (결함 후보) | 원본 validator 함수 V8 격리; `currentFacts` / `validSourceRef`는 stub, 정식 Node·D1 아님 |
| Draft PR #149 함수본문 동일 격리(정확/legacy/틀린 ID/관측 상충/잘못된 문서/미승인/누락/미등록 ID/기한 null) | 명시 ID 상충만 거절, 정상·legacy 보존 | **9/9 기대 일치** | Draft 코드 V8; 전체 Node CI 미실행 |

문서/항목별 실제 출처/추출값, tenant·document SHA CAS, 실제 DB migration, 같은 사건 원문→계산→법률→서식/갈음·법원 보정, 공식 법원 서식, 사람 승인 및 운영 배포는 **전부 미인증**이다. `0개 정확 소비처`를 `무용/삭제/0원`으로 해석하지 않는다.

## 역할별 중앙 보드 진행 ID (5개, 모두 `[ ]` 유지)

- **데이터 `A3-DATA-002`**: 20 canonical/20 slot/3서류/3family와 693/85/48/141/1,808 조인 재검증. 실사건 원문/복수행 DB ingest 미검증.
- **IT `A3-IT-017`**: base locator16+extension source anchor4, noCrossRecordBorrowing 20/20와 `extraction_*` 스키마를 확인. 실제 R2/D1 sourceHash 재독 미검증.
- **사용자·서류 `A3-DOC-016`**: court order 12 / enforcement 4 / pension 4 source-only의 제출·보정·갈음/역질문 증거용도, 실제 요구서류/갈음 승인 미검증.
- **계산사무장 `A3-CALC-020`**: 미납액·불능액·압류액은 즉시 원화 합계 금지, 계산 18/91 정확 직접 소비0. 실제 소득/채무/재산/배분 결속 미검증.
- **변호사 `A3-LAW-013`**: #507 법원 보정기한의 명시 canonical Fact 상충으로 잘못된 연결 가능성 **Draft PR #149**; D1/실제 사건·공식 명령·변호사 독립승인 필요.

직전 r60 **AX → IT → DOC → CALC → LAW**, 이번 r61 **DATA → IT → DOC → CALC → LAW**, 다음 r62 **AX 시작**. 6역할 첫 담당을 매 회차 교대하며 모든 역할 반복을 피한다.

## 다음 시작 / 변경·검증 증빙

- 순차 심층 재감사 **520/693 = 75.0%**, 잔여 **173개**. 다음 #521 `procedure_enforcement_garnishment::procedure.enforcement.claimed_amount`부터 **#521–540**. A3 총 124 체크 ID, 최종 `[x]` **0건**.
- main에는 이번 **영수증/보드 문서만**, code 변경은 Draft branch/PR #149에 격리. PR 미병합. 법률·계산·공식 서식 의미를 자동으로 고치지 않음.
- 안전상 금지: 실제 의뢰인 정보/PDF·키·.env·원본 OCR 사실값 공개, 운영 migration·배포·전자소송·인가판정. 법원/변호사 독립 검수 전 `unreviewed` 유지.

### 최신 조인 원천 blob SHA

- `lib/canonical-field-id-index.json` blob `27ecdddd208de82a2f5c675e7482485e3a8838c2`
- `lib/document-agent-field-contracts.json` blob `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`
- `lib/shared-document-field-contracts.json` blob `9decab974e0909ae24ad927bdfe241d75b71f3a9`
- `lib/ocr-field-supplements.json` blob `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`
- `lib/reference-intake-catalog.json` blob `ae6aa4fd2ef11ee0266b5ad05b2f9a96164daa99`
- `lib/field-applicability-contracts.json` blob `6076b26f782c4643a21a7b2f1a8f6261bb588b68`
- `lib/feature-lineage-audit.ts` blob `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`
- `lib/canonical-field-binding.ts` blob `60ee5c7762d52b72a165b4f4f8214680eb98f148`
- `lib/ocr-chain-matrix.ts` blob `977de86ba698bd805cc6b95d1384e3b49d0dbb4c`
- `lib/material-calculation-source-gate.ts` blob `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`
- `lib/legal-evidence-criteria.ts` blob `6c0b94535700d4fa4d356f8a91d5b9440b5ac52a`
- `lib/risk-catalog.json` blob `e96dd0926e3ae9be5a5573d4551538ba294c4d2e`
- `lib/legal-catalog.json` blob `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`
- `lib/legal-exceptions.json` blob `6e51197226bfd8320e1147d8df3f12c11e00927c`
