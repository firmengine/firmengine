# FirmEngine A3 제37차 — canonical #021–040 소비처 재감사

> 관측일 2026-11-01 KST. 원본 main 감사 SHA `b0c50ef8d4f56b6bf6dd6c6e812188b27016e87b`; `lib/canonical-field-id-index.json` blob `27ecdddd208de82a2f5c675e7482485e3a8838c2`. 경로 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만 대상으로 함. 실제 고객자료/원문 OCR·개인정보·키·운영 DB 접근 없음. **본 문서는 정적 계약/V8 원본 술어 감사이며 운영/법률/서식 인수 증빙이 아니다.**

## 이어받은 범위·역할 순환·중앙 보드
- [36차 #001–020 재감사](20261101-r36-canonical-001-020-source-only-gate.md)와 [2차 #021–040 최초 감사](20261030-1428-canonical-021-040.md) 이후 **#021–040 20 ID**를 현재 인덱스에서 순서대로 다시 조회.
- 이번 역할 순서 **계산사무장 → 사용자·서류담당자 → IT담당자 → 데이터담당자 → AX담당자**. 중앙 체크 ID `A3-CALC-013`, `A3-DOC-017`, `A3-IT-008`, `A3-DATA-003`, `A3-AX-020`. **모두 부분 [ ] 유지**, 최종 인수 0건. 다음은 **변호사** 시작.
- 먼저 GitHub `main` HEAD, 최근 커밋 및 Draft PR #99/#51, 중앙 보드, 실제 스키마/코드/기존 영수증과 기존 `tests/a3-canonical-register-order.test.mjs`, `tests/feature-lineage-audit.test.ts`의 테스트 정의를 확인함. **위 Node 테스트를 이번 회차에서 실행했다고 주장하지 않음.**
- 693 canonical 고유 ID, 85 문서, 48 family, 기본 source slots **1,789** + 보강 **19** = **1,808** 선언 슬롯을 계약 JSON으로 확인. 이번 범위는 `applicant_statement`/ `applicant_narrative_statement` 10개와 `application_form_input`/ `application_identity_venue` 10개, 정확히 **20 source slots / 2서류 / 2패밀리**.

## 입력·독립 기대·실제 관찰(검증 수준 명시)
실제 `main`의 `lib/canonical-field-id-index.json`, `lib/document-agent-field-contracts.json`, `lib/shared-document-field-contracts.json`, `lib/field-applicability-contracts.json`, `lib/ocr-field-supplements.json`, `lib/feature-lineage-audit.ts`, `lib/canonical-field-binding.ts`, `lib/ocr-chain-matrix.ts`, `lib/material-calculation-source-gate.ts`, `lib/reference-decision-tables.json`, `lib/form-mapping.ts`, `lib/legal-evidence-criteria.ts`, `lib/risk-catalog.json`, `lib/legal-catalog.json`, `lib/legal-exceptions.json`을 읽어 비교했다.

| 독립 검증 입력/기대 | 실제 검사 관찰 | 결과/한계 |
|---|---|---|
| #021–040은 인덱스의 정확한 순서로 20개 고유 ID | 20개 정확 조인, 중복 0; 전체 693 고유 | **정적 일치** |
| 각 ID가 원본 family에 존재, 문서 한 종류에 정확 라우팅 | 20/20 원본 base field, 20/20 문서 라우트 | **정적 일치**, 실제 OCR 문서 아님 |
| 모든 필드에 원본 문서ID/SHA/페이지 위치 요구, 기록 간 근거 차용 금지 | 20/20 source locator 선언, 두 문서 모두 `recordPolicy.noCrossRecordBorrowing=true`, `sourceOnly=true` | **계약 존재**, 실제 위치·복수행/원문 인용 0건 관측 |
| 적용조건 정확한 ID 등록 | 20/20 `field-applicability-contracts.json` 등록 | **정적 등록 일치**; 적용·법적 인정 여부 미인증 |
| 이번 canonical ID의 직접 서식 토큰 없음 | 13개 `OCR_DECLARED_FORM_TARGETS` exact ID와 교집합 0/20 | **정적 0**, 서식 제출 적합성 합격 아님 |
| 서로 다른 원천 단위 무단 환산 없음 | 전체 20개 `canonical_unit=not_applicable`; money 필드 없음 | **계약 확인**, 실제 환산·파싱 미실행 |
| 8개 독립 불변식 × 20개 ID | 정확 순서/원천등록/locator/문서라우트/recordPolicy/적용조건/서식비연결/금액부재 총 **160/160 단언 기대값 일치** | **정적·합성 검사만** |
| `feature-lineage-audit.ts` 원본 `hasPeriod`/`hasUnit`의 결과 | 원본 표현식을 추출해 20필드×2 **V8 격리 40회** 실행. 기간검토 true **5/20**, 단위검토 true **0/20** | **실행한 술어 검증만**, 인식·DB·실제 법률검증 아님 |
| 계산 모듈과 법률 카탈로그 수 | `reference-decision-tables.json` **18계산/91입력(78 고유)**, 위험95/규칙50/예외46; `LEGAL_EVIDENCE_POLICY_SEED.checks=[]` | **등록 규모 확인**, 95/50/46 승인·실행 인증 아님 |

**정확한 소비처 등록 구분:** `canonical-field-binding.ts`의 두 family 직접 typed projection **0/20**, `MATERIAL_CALCULATION_SOURCES` 정확 `canonicalFieldId` **0/20**, `OCR_DECLARED_FORM_TARGETS` 정확 token **0/20**, 95위험의 정확 `required_features` 계약 **0/20**. 법률규칙50·예외46·운영 승인형 기준정보에는 **이번 ID에 대한 승인된 소비처를 실증하지 못함**. 미등록·미승인 법률요건의 합격은 **0%**, 법률상 불필요 또는 무용이라는 뜻 아님.

## canonical ID별 증거 원천/타입/기간/대상·소비처 누적표
`P/U/A`=실제 원본 검사 술어의 기간/단위 검토 후보 및 적용조건 정확 등록. Y가 법률상 필수 날짜·단위 또는 원문에서 검증됐다는 뜻은 아니다. 모든 항목의 문서/페이지/SHA/인용 요구는 **선언**만 확인했고, 실제 `documentId/page/quote/bbox/recordIndex/subject identity`의 값·원본문장·기간·중복행은 **미관찰**.

| # | canonical ID | 증빙 문서 / OCR family | datatype / 원단위 | 대상 / temporal role | P/U/A | 정적 직접 소비처 |
|---:|---|---|---|---|:---:|---|
| 21 | `applicant_narrative_statement::identity.statement.admission_or_correction` | `applicant_statement` / `applicant_narrative_statement` | `text` / `not_applicable` | `applicant_debtor` / `not_applicable` | N/N/Y | evidence-only; typed/material/form/exact legal 0 |
| 22 | `applicant_narrative_statement::identity.statement.author` | `applicant_statement` / `applicant_narrative_statement` | `party_role` / `not_applicable` | `applicant_debtor` / `not_applicable` | N/N/Y | evidence-only; typed/material/form/exact legal 0 |
| 23 | `applicant_narrative_statement::identity.statement.event_end` | `applicant_statement` / `applicant_narrative_statement` | `date` / `not_applicable` | `applicant_debtor` / `event_date` | Y/N/Y | evidence-only; typed/material/form/exact legal 0 |
| 24 | `applicant_narrative_statement::identity.statement.event_start` | `applicant_statement` / `applicant_narrative_statement` | `date` / `not_applicable` | `applicant_debtor` / `event_date` | Y/N/Y | evidence-only; typed/material/form/exact legal 0 |
| 25 | `applicant_narrative_statement::identity.statement.narrative_text` | `applicant_statement` / `applicant_narrative_statement` | `text` / `not_applicable` | `applicant_debtor` / `not_applicable` | N/N/Y | evidence-only; typed/material/form/exact legal 0 |
| 26 | `applicant_narrative_statement::identity.statement.signature_status` | `applicant_statement` / `applicant_narrative_statement` | `enum` / `not_applicable` | `applicant_debtor` / `not_applicable` | N/N/Y | evidence-only; typed/material/form/exact legal 0 |
| 27 | `applicant_narrative_statement::identity.statement.signed_at` | `applicant_statement` / `applicant_narrative_statement` | `date` / `not_applicable` | `applicant_debtor` / `event_date` | Y/N/Y | evidence-only; typed/material/form/exact legal 0 |
| 28 | `applicant_narrative_statement::identity.statement.source_references` | `applicant_statement` / `applicant_narrative_statement` | `id_list_or_text` / `not_applicable` | `applicant_debtor` / `not_applicable` | N/N/Y | evidence-only; typed/material/form/exact legal 0 |
| 29 | `applicant_narrative_statement::identity.statement.statement_version` | `applicant_statement` / `applicant_narrative_statement` | `string` / `not_applicable` | `issuer` / `not_applicable` | N/N/Y | evidence-only; typed/material/form/exact legal 0 |
| 30 | `applicant_narrative_statement::identity.statement.topic` | `applicant_statement` / `applicant_narrative_statement` | `string` / `not_applicable` | `applicant_debtor` / `not_applicable` | N/N/Y | evidence-only; typed/material/form/exact legal 0 |
| 31 | `application_identity_venue::procedure.application.accepted_at` | `application_form_input` / `application_identity_venue` | `datetime` / `not_applicable` | `court` / `application_filing_datetime` | Y/N/Y | evidence-only; typed/material/form/exact legal 0 |
| 32 | `application_identity_venue::procedure.application.address` | `application_form_input` / `application_identity_venue` | `address` / `not_applicable` | `applicant_debtor` / `record_as_of_date` | Y/N/Y | evidence-only; typed/material/form/exact legal 0 |
| 33 | `application_identity_venue::procedure.application.applicant_name` | `application_form_input` / `application_identity_venue` | `string` / `not_applicable` | `applicant_debtor` / `not_applicable` | N/N/Y | evidence-only; typed/material/form/exact legal 0 |
| 34 | `application_identity_venue::procedure.application.case_number` | `application_form_input` / `application_identity_venue` | `string` / `not_applicable` | `court` / `not_applicable` | N/N/Y | evidence-only; typed/material/form/exact legal 0 |
| 35 | `application_identity_venue::procedure.application.court` | `application_form_input` / `application_identity_venue` | `party_role` / `not_applicable` | `court` / `not_applicable` | N/N/Y | evidence-only; typed/material/form/exact legal 0 |
| 36 | `application_identity_venue::procedure.application.jurisdiction_exception` | `application_form_input` / `application_identity_venue` | `text_or_enum` / `not_applicable` | `applicant_debtor` / `not_applicable` | N/N/Y | evidence-only; typed/material/form/exact legal 0 |
| 37 | `application_identity_venue::procedure.application.ordinary_venue_basis` | `application_form_input` / `application_identity_venue` | `text_or_enum` / `not_applicable` | `applicant_debtor` / `not_applicable` | N/N/Y | evidence-only; typed/material/form/exact legal 0 |
| 38 | `application_identity_venue::procedure.application.phone_home` | `application_form_input` / `application_identity_venue` | `masked_contact` / `not_applicable` | `applicant_debtor` / `not_applicable` | N/N/Y | evidence-only; typed/material/form/exact legal 0 |
| 39 | `application_identity_venue::procedure.application.phone_mobile` | `application_form_input` / `application_identity_venue` | `masked_contact` / `not_applicable` | `applicant_debtor` / `not_applicable` | N/N/Y | evidence-only; typed/material/form/exact legal 0 |
| 40 | `application_identity_venue::procedure.application.phone_work` | `application_form_input` / `application_identity_venue` | `masked_contact` / `not_applicable` | `applicant_debtor` / `not_applicable` | N/N/Y | evidence-only; typed/material/form/exact legal 0 |

## 발견된 소비처 공백·해석 금지 경계
1. **진술 시간과 법원 접수 시간 분리:** #023/#024 진술 사건 기간, #027 서명일, #031 법원 접수일시는 각각 서로 다른 시점이다. `form-mapping.ts`의 `application_date`는 `data.context.applicationDate`에서 오고, `#031::accepted_at`의 직접 typed/form 계약이 아니다. 서명일을 신청일로 복사하거나 접수시각을 제출/인가 확정으로 승격 금지.
2. **진술/서명 원천은 확정 진술서가 아님:** #025 `narrative_text`, #026 `signature_status`, #022 `author`, #028 `source_references`는 검증/서명·정정 버전·인용 역질문 대상으로 보존. `form-mapping.ts`의 `statement`는 별도 `applicantStatementForForm(data,index)` 경로를 사용; 단순한 문자열 유사성이 법원 양식으로 직접 연결을 입증하지 않는다. 필수 승인/공식 Word 확인되지 않음.
3. **관할 판단/개인정보:** #033 신청인 성명/#034 사건번호/#035 법원/#036 관할 예외/#037 일반재판적 근거는 원문·신청인·법원·효력시점 별도 검토. `court_name`은 `context.courtId=seoul`인 경우 별도 기본값 경로를 가진다. **이 경로는 #035 원문 증거의 검증/관할 적법성 승인과 동등하지 않음**. #038~040은 `masked_contact` 세 항목, 과금·원화 합산 금지.
4. **기록·갈음·법원 보정:** 두 증빙의 `recordPolicy.sourceOnly` 및 anchor 선언이 원본 D1 Fact의 실제 보존·동일주체 귀속·법원 제출을 증명하지 않는다. `approve-document-substitution.ts`, `preapproval-correction-audit.ts`, `substitution-policy.json`의 관리형 절차는 존재하지만 이번 20 ID에 대한 **실제 승인 갈음/정식 법원 보정·접수증 직접 연결은 미인증**. 0 소비처인 증빙도 삭제하지 말고 사실 확인/검산/역질문/정정자료로 보존.
5. **상태 혼동 금지:** `not_seen/null/0/explicit_none/conflicting/not_applicable`와 `source-only`/사람 승인/서식 제출을 서로 다른 상태로 보존. 앞선 36차에서 재현한 **null·원문 없는 explicit_none source-only 오인 후보**는 [Draft PR #99](https://github.com/firmengine/firmengine/pull/99) 미병합 상태, 실제 Node/SQLite 회귀 미인증. 새 고객 원본으로 검증했다고 주장하지 않음.

## 중앙 보드 체크 ID별 부분 검증 (전부 [ ] 유지)
| ID | 역할 | 정확히 관찰한 증거 / 미해소 |
|---|---|---|
| `A3-CALC-013` | 계산사무장 | 20개의 날짜·계산 경로 exact 검토, `#023/#024/#027/#031` 시간 의미 분리; 직접 typed/material/계산 0/20. 실제 산식/관할 법률 인정·시점 승인 미검증. |
| `A3-DOC-017` | 서류담당 | 2문서×20필드 출처앵커/recordPolicy 확인, 수집/법률상 인정/법원제출 별도; 실제 자료갈음·법원 보정·제출 승인 0건 관측. |
| `A3-IT-008` | IT | `OCR_DECLARED_FORM_TARGETS` 13 exact form 연결과 20 ID 교집합 0. `form-mapping.ts`는 별도 context/statement 경로. 실제 공식 서식 토큰·반복행·배포 미검증. |
| `A3-DATA-003` | 데이터 | 693/85/48/1808 정적 전수 합산, #021–040 20행 typed0/material0/form0/exact risk0. 원문 page/bbox/row/D1 저장·재독 미실행. |
| `A3-AX-020` | AX | `LEGAL_EVIDENCE_POLICY_SEED.checks=[]`와 법률·서식 후보/승인 경계 확인; Draft PR #99 P1 반례는 별도 검토·Node 회귀 전, 운영 법률 승인 자동화 미인증. |

## 검증 수준 및 다음 시작
- 실제 실행: 정적 JS 계약 단언 **160/160**, 원본 V8 기간·단위 술어 **40회**. 기존 테스트 **내용 열람만**; `node --test`/전체 CI/실 OCR·D1/R2/Cron/공식 법원 Word/변호사 검토/사이트 배포는 수행하지 않았다. 코드 존재≠합성 통과≠전체 CI≠staging≠공식 서식·실무 승인≠운영배포.
- 코드 변경/운영 마이그레이션/실제 전자제출·법원 인가 확정 **없음**. 5개 ID 전부 부분 [ ]; A3 제품 최종 인수 완료 0건.
- **다음 시작: #041 `application_identity_venue::procedure.application.resident_id` → #060**, 최신 인덱스 재조회 필요. 역할은 **변호사부터 시작**. #001–040의 미해결 소비처·source-state 검증은 계속 열린 상태이다.
