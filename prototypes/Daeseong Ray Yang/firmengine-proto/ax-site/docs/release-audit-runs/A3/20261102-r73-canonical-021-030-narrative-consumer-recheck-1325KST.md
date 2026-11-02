# FirmEngine A3 — 제73차 canonical #021–030 진술 증거·소비처 재감사

> 기준일: 2026-11-02 KST (13:25 회차). 감사 시작 `main` SHA: `d0e1b4365191c42cbfef89e782c20067a2307463`. 기준 보드 blob: `be24cbadb334d310d322fc6220280712e7c630ef`. authoritative canonical index blob: `27ecdddd208de82a2f5c675e7482485e3a8838c2`. 범위: 오직 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`. 실제 사용자 문서·개인정보·실 OCR·키·비공개 정답/운영 DB를 사용하지 않았다.

## 1. 이전 회차 이어받기 / 시작 범위

72차 영수증 `20261102-r72-canonical-011-020-accounting-source-consumer-recheck-1226KST.md`와 A3 중앙 보드의 미완료 ID부터 검토했다. **시작 #021, 이번 범위 #021–030 총 10개 ID / 10 원천 슬롯 / 1 공개서류 `applicant_statement` / 1 family `applicant_narrative_statement`**. 다음 순환 시작 담당은 AX이다. 이번 5개 회전: AX → IT → 사용자·서류 → 계산사무장 → 변호사. 중앙 체크 ID는 `A3-AX-020`, `A3-IT-008`, `A3-DOC-017`, `A3-CALC-013`, `A3-LAW-018` (모두 **[ ] 유지**).

실제 최신 JSON의 `reference-intake-catalog` 85문서 / `document-agent-field-contracts` 48 family / `canonical-field-id-index` 693고유 ID를 재조회했다. 각 문서의 허용 family별 base fields + shared-document extensions + OCR supplement를 독립 연결해 **141 라우트, 1,808 필드 슬롯, 693 고유ID, 중복·고아 0**을 얻었다. 18개 계산 정의의 원 입력 총 91개(중복 제거 78개), 법률위험95/법률규칙50/예외46도 각 JSON 배열을 재집계했다. *정적 등록 건수이지 실제 계산·법률 적용 실행 횟수가 아니다.*

선행 r37 보고와 구분: 이번에는 최신 원본 `canonical-field-binding`, `feature-lineage-audit`, `ocr-calculation-input`, `statement-paragraphs`의 **함수본문을 TypeScript 타입만 제거하여 V8에서 실행**, 결과를 아래와 같이 별도 기록했다. 원문 문서·D1 Fact·공식 Word·변호사 승인 실증은 여전히 0.

## 2. 열거된 ID별 source → 소비처 및 공백

공통 원천 조건: `applicant_statement` 문서의 `recordPolicy.sourceOnly=true`, `noCrossRecordBorrowing=true`, `one_source_entity_event_or_period_per_record`; 문단·작성자·버전·section/paragraph anchor 별도 record. 각 10개 필드가 `document_id/document_sha256/page/quote` locator 의무를 **선언**한다(가능한 경우 bbox, 원문 행/열/영역 포함). 실제 OCR 원문/페이지 해시·복수행·대상자 증거는 **미관찰**. 적용조건은 10/10 ID별 등록이나 **서류/사건별 승인 아님**. P/U/A는 원본 술어에 의한 *기간검토/단위검토/조건등록*, 승인 여부 아님.

| # | 실제 canonical ID | type / 원단위 | 대상 / 시간역할 | P/U/A | 안전한 증거·검산·역질문 후보 | 정확 직접 소비처 |
|---:|---|---|---|:---:|---|---|
| 021 | `applicant_narrative_statement::identity.statement.admission_or_correction` | `text` / `not_applicable` | `applicant_debtor` / `not_applicable` | N/N/Y | 정정·불확실 주장/원문 비교 | source-only; typed0 / material0 / exact form0 / approved legal0 |
| 022 | `applicant_narrative_statement::identity.statement.author` | `party_role` / `not_applicable` | `applicant_debtor` / `not_applicable` | N/N/Y | 작성자·동일인·원문서명 역질문 | source-only; typed0 / material0 / exact form0 / approved legal0 |
| 023 | `applicant_narrative_statement::identity.statement.event_end` | `date` / `not_applicable` | `applicant_debtor` / `event_date` | Y/N/Y | 서술 사건 종료일/기간 귀속 | source-only; typed0 / material0 / exact form0 / approved legal0 |
| 024 | `applicant_narrative_statement::identity.statement.event_start` | `date` / `not_applicable` | `applicant_debtor` / `event_date` | Y/N/Y | 서술 사건 시작일/기간 귀속 | source-only; typed0 / material0 / exact form0 / approved legal0 |
| 025 | `applicant_narrative_statement::identity.statement.narrative_text` | `text` / `not_applicable` | `applicant_debtor` / `not_applicable` | N/N/Y | 문단별 원문 인용/검증/초안 후보 | source-only; typed0 / material0 / exact form0 / approved legal0 |
| 026 | `applicant_narrative_statement::identity.statement.signature_status` | `enum` / `not_applicable` | `applicant_debtor` / `not_applicable` | N/N/Y | 실제 서명확인·서명자 보류 | source-only; typed0 / material0 / exact form0 / approved legal0 |
| 027 | `applicant_narrative_statement::identity.statement.signed_at` | `date` / `not_applicable` | `applicant_debtor` / `event_date` | Y/N/Y | 실제 서명일/버전 대조 | source-only; typed0 / material0 / exact form0 / approved legal0 |
| 028 | `applicant_narrative_statement::identity.statement.source_references` | `id_list_or_text` / `not_applicable` | `applicant_debtor` / `not_applicable` | N/N/Y | 증빙 인용ID 실존/범위 검증 | source-only; typed0 / material0 / exact form0 / approved legal0 |
| 029 | `applicant_narrative_statement::identity.statement.statement_version` | `string` / `not_applicable` | `issuer` / `not_applicable` | N/N/Y | 개정·철회·이전 문안 대조 | source-only; typed0 / material0 / exact form0 / approved legal0 |
| 030 | `applicant_narrative_statement::identity.statement.topic` | `string` / `not_applicable` | `applicant_debtor` / `not_applicable` | N/N/Y | 문항/문단/관련 사건 주제 분리 | source-only; typed0 / material0 / exact form0 / approved legal0 |

직접 typed projection `canonical-field-binding.ts`: **0/10**. 29개 `MATERIAL_CALCULATION_SOURCES`의 정확 ID 대조: **0/10**. `OCR_DECLARED_FORM_TARGETS`의 정확 토큰: **0/10**. 95위험 중 승인된 정확 canonical 증거계약: 정적 `LEGAL_EVIDENCE_POLICY_SEED.checks=[]` 때문에 **0/10**. 이 수치는 미승인·미등록에 대한 **승인 합격 0%**이며 피처 무용·삭제 판단이 아니다. `referenceReviewCandidates`는 일반 제안일 뿐 공식 서식 요구/현행 법률의 인정 기준이 아니다.

**실제 소비 경로의 차이:** `statement-paragraphs.ts`의 `sourceStatementText`는 `statement.text` Fact·원문 인용·단일 서류/페이지·작성자 `statement.author_role` / `applicant_intent` / `author_signature` / scope 관계/철회·중복을 별도로 엄격하게 요구한다. `form-mapping.ts`는 `applicantStatementForForm(data,index)`의 `statement` 결과를 문서 필드에 출력하는 **별도 context/statement Fact 경로**다. 이를 이번 canonical #025의 *정확 OCR ID에서 공식 법원 서식 token으로 승인된 직접 연결*이라고 표시하면 안 된다. 문서 갈음 `document-substitution.ts`와 법원 보정 `preapproval-correction-audit.ts`의 정책 함수가 있다는 사실만으로 이 10개 원천증거의 갈음 승인·보정 이행·법원 접수를 보증할 수 없다.

**DB 구조:** `db/schema.ts`에는 `extraction_records`, `extracted_features`, `extraction_field_coverage`가 있으며 `extracted_features.canonical_field_id/raw_value_json/source_state/quote/bbox_json`, `extraction_field_coverage.observation_status`를 구분한다. `drizzle/0016_source_field_coverage.sql`의 스키마 정의를 읽었으나 실제 D1 데이터·마이그레이션은 실행하지 않았다.

## 3. 입력/독립 기대/관찰 — 실제 격리 V8 실행 50개 assertion, 원본문 호출 60회

실제로 조회한 `main` 함수본문의 TS 타입표기만 제거했다. `bindCanonicalSourceField`에는 실제 family별 10개 정의를 공급했다. `hasPeriod/hasUnit`은 원본 술어 그대로 사용했다. `calculationSourceCellIssues`의 `normalizeMoney`만 **가상 KRW exact stub**으로 주입했으나 이번 10개는 모두 비금전 타입이므로 KRW 환산 판정은 시험하지 않았다. `applicantStatementForForm`의 외부 `sourceStatementText`는 명시적으로 `SYNTHETIC VERIFIED SOURCE`를 반환하는 stub이었다. 즉 실제 OCR·서명·검증체인을 통과시킨 시험이 아니다.

| 실제 실행 시험 | 합성 입력 | 독립 기대 | 원본문 관찰 | 판단 |
|---|---|---|---|---|
| exact/explicit canonical ID | 10필드 각각 `local_id`+정확 ID 또는 단독 정확 local key | 20번 모두 ID 결속, issue 없음 | **20/20 정확 결속** | 함수 격리 일치 |
| 교차·오류 ID | 다른 family ID, 다른 local key와 결합, 미등록 local, 제3 family ID | 모두 fail-closed | **4/4 unbound/issues 발생** | 함수 격리 일치 |
| 기간·단위 | 10개 필드의 temporal_role/datatype | period 3개 true, 나머지 false; unit 10개 false | **10개 period / 10개 unit 예상 일치** | 술어 격리 일치 |
| 날짜 오류 | #023 `2026-02-30`, #027 `not-a-date` | `SOURCE_DATE_INVALID` | 동일 코드 2건 | 형식검사 작동 |
| 유효한 날짜 | #024 `2026-01-05` | `[]` | `[]` | **형식 한정** |
| 인용 없음 | #025 `Synthetic paragraph`, quote=`""` | `SOURCE_QUOTE_MISSING` | 동일 | quote 형식 한정 |
| 상태 enum 의심 | #026 `signed_by_robot`, present+quote | 현 함수는 enum 의미검증 없음 | `[]` | **법률상 서명 검증 아님** |
| 외부 인용 연결 없음 | #028 `fake-evidence:1`, present+quote | 현 함수는 id_list_or_text 링크 검증 없음 | `[]` | **ID 존재성 검증 아님** |
| 알 수 없는 작성자 | #022 `no-identified-author`, present+quote | 현 함수는 party_role 의미검증 없음 | `[]` | **작성자 승인 아님** |
| 미관찰 / 명시 없음 / 상충 | #025 null/`not_seen`; #026 null/`explicit_none`; #023 잘못된 날짜/`conflicting` | 세 경우 형식검사 적용 안 함 | 3건 모두 `[]` | **미관찰/null/상충≠승인** |
| 관찰된 빈 값 | #030 `""` / present | `SOURCE_PRESENT_VALUE_MISSING` | 동일 | 형식검사 작동 |
| 일반 정정 주장 | #021 `synthetic correction claimed` | 현재 text 형식검사 `[]` | `[]` | 진술 사실확정 아님 |
| 수기 context 우선순위 | 저장된 `MANUAL SYNTHETIC STATEMENT` / 독립 source stub 존재 | 저장된 수기 문안을 우선 | 수기 문안 | 1/1 기존 동작 확인 |
| source fallback | 저장 문안 없음 또는 whitespace | source stub 문안 | source stub 문안 | 2/2 기존 동작 확인 |
| 수기 이전판본 존재 | `DRAFT PRIOR VERSION` + source stub | 수기 판본 우선 | 수기 판본 | 1/1 기존 동작 확인 |

**총 50개의 시험 케이스(결속 24 + 술어 10쌍 + 형식 12 + 문안우선순위 4), 내부 원본문 함수 호출 60회; 50/50 현재 동작 기대 일치.** 여기서 enum, source-ref, 작성자 값의 `[]`는 *그 좁은 셀 형식검사 함수가 판단하지 않는다*는 뜻이다. 독립 **업무/법률 승인 기대에 대한 통과율로 계산하지 않는다**.

### 신규 연결 검토 항목 (결함 확정 아님)

1. **P2 조사후보 — #026/#028/#022:** `calculationSourceCellIssues`는 enum/인용목록/역할의 실제 의미·ID 실존을 확인하지 않고 `[]` 반환. 상위 검증기/서명 source scope 체인이 별도 검증하는지 실제 CaseData/Node E2E로 확인해야 한다. 허위 서명 승인이나 법원 제출 통과를 입증한 결과는 아니다.
2. **P2 조사후보 — source-only 진술 vs 서식 수기 context 우선:** `applicantStatementForForm`은 `data.context.applicant.statement`가 존재하면 이를 보낸다. 이 흐름은 명시 수기 입력으로 설계된 것으로 보이며, `sourceStatementText`의 엄격한 원문 검증을 *동일하게 통과했다는 증거는 아니다*. 수기 입력에 대한 담당자 확인, 작성자/버전, 사건/서식 provenance와 최종 법률 승인 게이트가 어디에서 보장되는지 별도 시험 필요. 자동 덮어쓰기/무단 수정 없음.
3. **P2 조사후보 — #023/#024/#027/#029:** 사건 발생기간, 서명일, 진술서 판본이 불일치하는 경우의 실제 갱신/철회·우선순위 및 법원 보정 이후 문안 유효성 확인 미관찰. 날짜 간 단순 크기 비교나 신청일 자동 복제 금지.

## 4. 중앙 보드 5개 ID — 실제 수행 근거와 미완료 사유

| 시작 역할 / 보드 ID | 관찰 | 종료 상태 |
|---|---|---|
| AX `A3-AX-020` | 10 source-only/정적 legal seed 0, 정확 typed/material/form/approved legal 0; 수기 context vs source guard 격리 4건 | **[ ]** 승인형 법률정책·서식 실무 승인 미관찰 |
| IT `A3-IT-008` | exact token 0/10; `form-mapping`이 `applicantStatementForForm`을 호출함을 원본문 확인 | **[ ]** 실 공식 Word 생성·token binding/배포 미시험 |
| 사용자·서류 `A3-DOC-017` | 작성자/서명/문안/수정본 10개 source-only와 기록 분리, `statement-paragraphs` 원본문의 anchor/quote 검증 경로 확인 | **[ ]** 실 상담 문안·수집, 진술 서명·법적 인정·법원 제출 수령증 미관찰 |
| 계산사무장 `A3-CALC-013` | 사건 시작/끝 #023/#024, 서명 #027 독립; 직접 18계산·91입력 0개 선언, 날짜형 V8 3사례 | **[ ]** 신청/접수/서명/사건기간의 실제 법률 판본·계산 소비 없음 |
| 변호사 `A3-LAW-018` | 정적 승인 법률 계약 0/10, `LEGAL_EVIDENCE_POLICY_SEED.checks=[]`, 수기 진술 인정·보정 승인과 구분 | **[ ]** 관할/시행일·현행 승인정책/변호사 인가 미관찰 |

전회차 진행 상태 계승: r71 Draft PR #169(날짜범위·연말정산 형식), r37/r36 Draft PR #99(미관찰·원문 없는 explicit_none 보존), Draft PR #51(기간 술어) 미병합 진단 참고. 이번 범위에서 해당 정책/법률 의미 변경을 확정하지 않아 **제품 코드·PR 신규 생성/병합 없음**. 사람 승인 없는 자동 법률값 승격, 자료 삭제, 원화 합산, 운영 배포·마이그레이션·전자제출 전부 없음.

## 5. 검증 단계 정확 구분 및 다음 시작

- GitHub 원본 main/Board/기준정보/실제 코드·기존 테스트를 조회하고 정적 693/85/48/1808/18/91/95/50/46 조인, V8 원본문 부분격리 50케이스(60호출)를 실행한 것이 이번 회차 **관찰 가능한 범위**다.
- Node 전체 테스트/CI, 실제 OCR 원문·서명/페이지·복수행·R2, staging D1/R2/Cron, 공식 법원 Word/e-form, 법률 인가·변호사 서명/제출·운영 사이트 배포는 **수행/인증하지 않았다**.
- `not_seen` / `null` / 관찰 `0` / `explicit_none` / `conflicting` / `not_applicable` / `source_only` / 승인전은 별도 상태. 값이 없거나 소비처가 0개라도 자동 삭제·법률상 무용 또는 0원 합산 판단 금지.
- **누적 순차 정적 조사 693/693, 최종 A3 인수 0/124 (모든 ID [ ])**. 다음 미해결 소비처 재감사 시작 **#031 `application_identity_venue::procedure.application.accepted_at` → #040**, 다음 시작 역할 **IT** (역할 순환 지속).

## 6. 이번 조회의 핵심 blob SHA

| 경로 (모두 ax-site 상대) | blob SHA |
|---|---|
| `lib/document-agent-field-contracts.json` | `9884b3fecf44643fefcdc4a421ed66ffc5477b3a` |
| `lib/canonical-field-id-index.json` | `27ecdddd208de82a2f5c675e7482485e3a8838c2` |
| `lib/field-applicability-contracts.json` | `6076b26f782c4643a21a7b2f1a8f6261bb588b68` |
| `lib/canonical-field-binding.ts` | `60ee5c7762d52b72a165b4f4f8214680eb98f148` |
| `lib/feature-lineage-audit.ts` | `de81bc3b8c460b8a4dde3fda9e13087e619e74ff` |
| `lib/ocr-calculation-input.ts` | `8f7f51bf41f7c944b76419d7cc894e49ac771473` |
| `lib/statement-paragraphs.ts` | `6d364f2af016f99053889c5189e122477e868dd2` |
| `lib/ocr-chain-matrix.ts` | `977de86ba698bd805cc6b95d1384e3b49d0dbb4c` |
| `lib/material-calculation-source-gate.ts` | `0286b44484913b63fa8ec3f7bf0ca59b034d0dab` |
| `lib/reference-decision-tables.json` | `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` |
| `lib/shared-document-field-contracts.json` | `9decab974e0909ae24ad927bdfe241d75b71f3a9` |
| `lib/legal-evidence-criteria.ts` | `6c0b94535700d4fa4d356f8a91d5b9440b5ac52a` |
| `db/schema.ts` | `933f8686845ac14669312dd21bf85e02c62ed5e6` |
| `drizzle/0016_source_field_coverage.sql` | `c5c233909a3eeeaee430aa63c566600734299e20` |

## 7. 중앙 보드 A3 6역할 체크 ID 전체 (현재 공개 기준)

- DATA (22): `A3-DATA-001`, `A3-DATA-002`, `A3-DATA-003`, `A3-DATA-004`, `A3-DATA-005`, `A3-DATA-006`, `A3-DATA-007`, `A3-DATA-008`, `A3-DATA-009`, `A3-DATA-010`, `A3-DATA-011`, `A3-DATA-012`, `A3-DATA-013`, `A3-DATA-014`, `A3-DATA-015`, `A3-DATA-016`, `A3-DATA-017`, `A3-DATA-018`, `A3-DATA-019`, `A3-DATA-020`, `A3-DATA-021`, `A3-DATA-022`
- IT (20): `A3-IT-001`, `A3-IT-002`, `A3-IT-003`, `A3-IT-004`, `A3-IT-005`, `A3-IT-006`, `A3-IT-007`, `A3-IT-008`, `A3-IT-009`, `A3-IT-010`, `A3-IT-011`, `A3-IT-012`, `A3-IT-013`, `A3-IT-014`, `A3-IT-015`, `A3-IT-016`, `A3-IT-017`, `A3-IT-018`, `A3-IT-019`, `A3-IT-020`
- DOC (20): `A3-DOC-001`, `A3-DOC-002`, `A3-DOC-003`, `A3-DOC-004`, `A3-DOC-005`, `A3-DOC-006`, `A3-DOC-007`, `A3-DOC-008`, `A3-DOC-009`, `A3-DOC-010`, `A3-DOC-011`, `A3-DOC-012`, `A3-DOC-013`, `A3-DOC-014`, `A3-DOC-015`, `A3-DOC-016`, `A3-DOC-017`, `A3-DOC-018`, `A3-DOC-019`, `A3-DOC-020`
- CALC (20): `A3-CALC-001`, `A3-CALC-002`, `A3-CALC-003`, `A3-CALC-004`, `A3-CALC-005`, `A3-CALC-006`, `A3-CALC-007`, `A3-CALC-008`, `A3-CALC-009`, `A3-CALC-010`, `A3-CALC-011`, `A3-CALC-012`, `A3-CALC-013`, `A3-CALC-014`, `A3-CALC-015`, `A3-CALC-016`, `A3-CALC-017`, `A3-CALC-018`, `A3-CALC-019`, `A3-CALC-020`
- LAW (22): `A3-LAW-001`, `A3-LAW-002`, `A3-LAW-003`, `A3-LAW-004`, `A3-LAW-005`, `A3-LAW-006`, `A3-LAW-007`, `A3-LAW-008`, `A3-LAW-009`, `A3-LAW-010`, `A3-LAW-011`, `A3-LAW-012`, `A3-LAW-013`, `A3-LAW-014`, `A3-LAW-015`, `A3-LAW-016`, `A3-LAW-017`, `A3-LAW-018`, `A3-LAW-019`, `A3-LAW-020`, `A3-LAW-021`, `A3-LAW-022`
- AX (20): `A3-AX-001`, `A3-AX-002`, `A3-AX-003`, `A3-AX-004`, `A3-AX-005`, `A3-AX-006`, `A3-AX-007`, `A3-AX-008`, `A3-AX-009`, `A3-AX-010`, `A3-AX-011`, `A3-AX-012`, `A3-AX-013`, `A3-AX-014`, `A3-AX-015`, `A3-AX-016`, `A3-AX-017`, `A3-AX-018`, `A3-AX-019`, `A3-AX-020`

## 8. Canonical OCR 전체 693 ID 순서 — 이번 main authoritative index

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
