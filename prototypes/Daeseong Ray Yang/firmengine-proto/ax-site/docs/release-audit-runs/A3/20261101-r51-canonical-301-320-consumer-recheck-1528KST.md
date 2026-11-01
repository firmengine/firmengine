# FirmEngine A3 r51 — canonical OCR #301–320 소비처 심층 재감사

- 감사일: 2026-11-01 KST. 읽기·쓰기 전 `main` HEAD: `03f32fe69d882955d4b5831f3a564c3f6f99803e`. 변경 허용 범위 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/`만 사용.
- 인수 기준: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` A3 6담당자 124개 ID. 직전 [r50 #281–300](20261101-r50-canonical-281-300-consumer-recheck.md)과 최초 [r16 #301–320](20261031-r16-canonical-301-320-0431.md)을 읽은 후, 최신 본문·JSON·메타데이터를 **#301부터 인덱스 순서대로 재조회**.
- 역할 순환: **데이터담당자 → IT담당자 → 사용자·서류담당자 → 계산사무장 → 변호사**, 다음 **AX담당자**. 이번 5개 보드 ID `A3-DATA-003`, `A3-IT-020`, `A3-DOC-002`, `A3-CALC-001`, `A3-LAW-001` 모두 **[ ] 유지**.
- 검증 수준: 실제 GitHub main의 JSON/TypeScript/기존 테스트 코드를 조회; 독립 JS 소스 조인과 실제 `feature-lineage-audit.ts` `hasPeriod`/`hasUnit`/`reviewScope`에서 타입 주석만 제거한 함수 격리 실행. **독립 기대값 40/40 일치**는 정적·V8 격리 단언 결과이며, native Node 테스트·전체 CI·실 OCR·D1/R2/Cron·Word 양식·변호사 승인·사이트 배포 통과가 아니다.

## 핵심 결과와 미인수 조건

| 항목 | 실제 관찰 | 인증 의미 |
|---|---:|---|
| canonical/서류/패밀리/선언 source slots | **693 / 85 / 48 / 1,808** | 번호표와 authoritative ID 순서 일치, 고아·중복 0 |
| 이번 #301–320 | **20개/52 source slots/5서류** | 이혼4×3=12, 고용서명2, 고용이력6, 근로계약기본8×4=32 |
| 정확한 적용조건 등록 | **8/20** | #313–320의 원천 조건 등록은 법률 승인과 다름 |
| 정확한 적용조건 미등록 | **12/20 (#301–312)** | **각 요건 0% 합격**, 자동 미적용/무용·삭제/승격 금지 |
| 직접 typed / 정확 18계산 입력 / material 필수원천 / 서식 토큰 / exact 법률 요건 | **0 / 0 / 0 / 0 / 0 (20개 중)** | 직접 선언 미연결임. 원천 증빙/검산/역질문 가치는 보존 |
| main 원본 기간·단위 술어 | **20+20 호출** (기간 Y 10, 단위 Y 3; 모든 입력 독립 메타데이터 기대와 일치) | 메타데이터 판정이지 실제 인식 정확도 아님 |
| 법률 seed | 95 risk / 50 rules / 46 exception / `legal-evidence-criteria.ts checks:[]` | 승인형 운영 DB/관할/시행일/사건 적용/변호사 결재 **미관찰** |
| 갈음 정책 | 8 routes 등록, 이번 5서류 ID 직접 갈음 라우트 0 | 대체 서류의 법원 인정·실제 보정 대응 E2E 미검증 |
| 문서·페이지·복수행 정책 | 85/85 `sourceOnly=true`, `noCrossRecordBorrowing=true` | 실제 원문 행·페이지·해시·인용/bbox 저장 및 재독 실증 아님 |

### P2 — 적용조건 미등록 12개
`field-applicability-contracts.json`에서 #301–312 ID가 개별 `fields[].id`에 **정확히 존재하지 않음**. `document-agent-registry.ts`의 `compactFamilyFieldContract`는 등록 미존재 시 `sourceCondition=null` 반환. `shared-document-field-contracts.json`의 확장 필드 정의/설명은 법률상 적용조건 승인과 다르다. 등록된 #313–320의 원천 조건 8개를 확장 필드에 복사하지 않는다. 향후 담당자가 각 문서·주체·발급일·기간/비용/고용형태를 원본으로 검토하고 관할/시행일/법적 인정 정책을 제시해야 한다.

### P2 연속 — 이혼 양육비 4필드의 배우자 검토 후보 단절
`#301–304`는 `divorce_records`에 속하나 실제 OCR 패밀리는 `asset_transfer_disposition`, `identity_residence_record`, `household_composition_support`. main `reviewScope` 실제 함수 격리 실행에서 세 패밀리 모두 `SEOUL-406` 후보 **미반환**, 반면 합성 `spouse_synthetic`은 반환. 즉 기존 r50 #293–300과 같은 문서명/라우트 불일치가 4 ID, 12 source slots로 확장 확인. `SEOUL-406`의 원문 근거·관할·시행일·법률승인 자체는 미인증이므로 자동 필수 규칙으로 연결/승격하지 않는다. 실제 법원 결정 오류를 입증한 결과는 아니다.

### P2 의미 검토 후보 — 지급주기와 근로 계속성
`#302 support_period`는 기간 플래그 Y지만 `#303 support_periodic_amount`는 `money` 및 원통화/주기 정보가 있어도 `temporal_role=not_applicable`로 기간 플래그 N. 동일 원천행의 양육비 지급자·수령인·기간·금액이 실제 Case Fact와 서식/산식에 묶이는지 미검증. `#314 base_wage`의 원천단위는 **KRW + pay period**, `#320 hours`는 **hours/week**로 무단 원화 합산 금지. 계약 기본급은 실수령액 `income.net`·법률 인정 월소득으로 자동 변환하지 않는다. `#308–310` 자격기간과 `#319` 계약 종료일도 별도 사건으로 대조한다.

## 20개 피처별 실제 source/소비처/공백 — canonical index 순서

라우트 범례: **D** = `divorce_records@asset_transfer_disposition; divorce_records@identity_residence_record; divorce_records@household_composition_support`; **C** = `employment_contract@employment_relationship`; **H** = `employment_history@employment_relationship`; **E** = `income_source_inventory@employment_relationship; employment_certificate@employment_relationship; employment_contract@employment_relationship; employment_history@employment_relationship`. 괄호 안 숫자는 실제 원천 슬롯 수.
각 행의 직접 소비 열 **typed/18계산/material/서식토큰/정확 법률** = **0/0/0/0/0**은 해당 소스의 정확 선언 기준이다. OCR source-only 및 증거 보존·교차검산·누락시 역질문·갈음/법원 보정 검토는 유지하며, 자동 불필요·법률 인가 확정으로 승격하지 않는다. **P/U**는 원본 `hasPeriod`/`hasUnit` 격리 결과.

| # | canonical ID | 문서×OCR family / source slots | 타입·원천단위·시간역할·대상 | 적용조건 | P/U | 직접 소비 5축 | 증거·검산·역질문 용도 |
|---:|---|---|---|---|---|---|---|
| 301 | `divorce_records::support_payer` | D / 3 | `party_role` / `not_applicable` / `not_applicable` / `document_subject` | **미등록·0% 합격** | N/N | 0/0/0/0/0 | 지급의무 주장자와 실제 지급자 구별 |
| 302 | `divorce_records::support_period` | D / 3 | `period` / `not_applicable` / `source_date_time_or_period` / `document_subject` | **미등록·0% 합격** | Y/N | 0/0/0/0/0 | 지급의무 기간·실지급 기간 확인 |
| 303 | `divorce_records::support_periodic_amount` | D / 3 | `money` / `source currency/unit` / `not_applicable` / `document_subject` | **미등록·0% 합격** | N/Y | 0/0/0/0/0 | 정기 부양비 금액·지급주기·실지급 분리 |
| 304 | `divorce_records::support_recipient` | D / 3 | `party_role` / `not_applicable` / `not_applicable` / `document_subject` | **미등록·0% 합격** | N/N | 0/0/0/0/0 | 수령인과 자녀/신청인 동일성 검토 |
| 305 | `employment_contract::employer_signature_date` | C / 1 | `date` / `YYYY-MM-DD` / `source_date_time_or_period` / `document_subject` | **미등록·0% 합격** | Y/N | 0/0/0/0/0 | 서명일·효력일·원문 서명 대조 |
| 306 | `employment_contract::employer_signature_status` | C / 1 | `enum` / `not_applicable` / `not_applicable` / `document_subject` | **미등록·0% 합격** | N/N | 0/0/0/0/0 | 서명 확인/공백/미관찰 분리 |
| 307 | `employment_history::insurance_scheme` | H / 1 | `category` / `not_applicable` / `not_applicable` / `document_subject` | **미등록·0% 합격** | N/N | 0/0/0/0/0 | 가입보험 종류·기록 발행자 확인 |
| 308 | `employment_history::qualification_acquired` | H / 1 | `date` / `not_applicable` / `source_date_time_or_period` / `document_subject` | **미등록·0% 합격** | Y/N | 0/0/0/0/0 | 자격 취득일과 근로시작일 별도 |
| 309 | `employment_history::qualification_lost` | H / 1 | `date` / `not_applicable` / `source_date_time_or_period` / `document_subject` | **미등록·0% 합격** | Y/N | 0/0/0/0/0 | 자격 상실일과 퇴사일 별도 |
| 310 | `employment_history::qualification_record_scope` | H / 1 | `period` / `not_applicable` / `source_date_time_or_period` / `document_subject` | **미등록·0% 합격** | Y/N | 0/0/0/0/0 | 조회기간·유효기간과 근로기간 구분 |
| 311 | `employment_history::qualification_type` | H / 1 | `category` / `not_applicable` / `not_applicable` / `document_subject` | **미등록·0% 합격** | N/N | 0/0/0/0/0 | 취득/상실/자격 유형 원문행 식별 |
| 312 | `employment_history::qualification_workplace` | H / 1 | `string` / `not_applicable` / `not_applicable` / `document_subject` | **미등록·0% 합격** | N/N | 0/0/0/0/0 | 근무처 사업자 식별·동명이인 구별 |
| 313 | `employment_relationship::income.employment.allowance_terms` | E / 4 | `text` / `not_applicable` / `period_scope` / `applicant_debtor` | 정확등록(원천 조건) | Y/N | 0/0/0/0/0 | 수당 조건·실제 지급·기간 대조 |
| 314 | `employment_relationship::income.employment.base_wage` | E / 4 | `money` / `KRW + pay period` / `period_scope` / `applicant_debtor` | 정확등록(원천 조건) | Y/Y | 0/0/0/0/0 | 계약 기본급은 실수령 income.net 아님 |
| 315 | `employment_relationship::income.employment.contract_term` | E / 4 | `date_range` / `not_applicable` / `period_scope` / `applicant_debtor` | 정확등록(원천 조건) | Y/N | 0/0/0/0/0 | 계약기간·지속소득 인정 분리 |
| 316 | `employment_relationship::income.employment.employee` | E / 4 | `party_role` / `not_applicable` / `not_applicable` / `applicant_debtor` | 정확등록(원천 조건) | N/N | 0/0/0/0/0 | 근로자와 신청인·가구원 동일성 대조 |
| 317 | `employment_relationship::income.employment.employer` | E / 4 | `party_role` / `not_applicable` / `not_applicable` / `employer` | 정확등록(원천 조건) | N/N | 0/0/0/0/0 | 법적 사용자·급여 지급자 대조 |
| 318 | `employment_relationship::income.employment.employment_type` | E / 4 | `enum` / `not_applicable` / `not_applicable` / `applicant_debtor` | 정확등록(원천 조건) | N/N | 0/0/0/0/0 | 정규·계약·겸업·휴업 분기 역질문 |
| 319 | `employment_relationship::income.employment.end_date` | E / 4 | `date` / `not_applicable` / `effective_date` / `applicant_debtor` | 정확등록(원천 조건) | Y/N | 0/0/0/0/0 | 종료일·퇴직일·현재 근무 구분 |
| 320 | `employment_relationship::income.employment.hours` | E / 4 | `decimal` / `hours/week` / `period_scope` / `applicant_debtor` | 정확등록(원천 조건) | Y/Y | 0/0/0/0/0 | 주당 시간은 화폐금액 아님 |

SQL 저장 계약: `extraction_records` → `extracted_features`(`canonical_field_id`, `raw_value_json`, `unit`, `source_state`, `quote`, `bbox_json`, `record_id`, ordinal)·`extraction_field_coverage`. 문서ID/페이지/행 ordinal/출처 hash·quote/bbox·대상자·기간을 서로 다른 Fact에서 임의 차용해서는 안 됨. 이 회차는 실제 D1 행과 원본 PDF를 열람하지 않았으므로 이 저장 계약의 **존재**와 **실값 보존 성공**은 동의어가 아니다.

## 실제 독립 검증 — 입력/기대/관찰/판정

| 시험군 | 입력/독립 기대 | V8 정적·격리 관찰 | 판정 |
|---|---|---|---|
| 1–4 번호표 | canonical=693, 고유=693, 번호표=693, 번호·ID 불일치=0 | 693, 693, 693, 0 | 4/4 계약 기대 일치 |
| 5–12 전원천 | 문서85/패밀리48/라우트1808, 미등록패밀리0/중복0/고아0/누락0, source-only 행분리 선언85 | 85/48/1808, 0/0/0/0, 85 | 8/8 계약 기대 일치 |
| 13–19 이번 범위 | 시작 #301·끝 #320 정확 ID, 20 ID/52슬롯/5서류/이혼12슬롯/근로관계32슬롯 | 동일 | 7/7 계약 기대 일치 |
| 20–22 조건 등록 | 정확 등록 8/미등록12, 미등록 정확 집합 #301–312 | 8/12, 집합 일치 | 3/3 **등록 공백 식별** (12개 합격 아님) |
| 23–28 직접소비/의미 | 직접 typed0/정확 계산0/material0/서식0/exact 법률0/같은 ID 의미충돌0 | 0/0/0/0/0/0 | 6/6 정적 계약 기대 일치 |
| 29–32 술어/후보 | 기간 역할오차0, 단위 타입오차0, 이혼 4필드 SEOUL-406 표시0, 합성 spouse 후보 Y | 0, 0, 0, Y | 4/4 원본 함수 격리 기대 일치 |
| 33–40 계산·법률·갈음 | 18계산/91입력/78고유/95위험/50규칙/46예외, seed 빈배열 Y, 직접 갈음0 | 18/91/78/95/50/46, Y, 0 | 8/8 정적 계약 기대 일치 |

여기서 **40/40**은 제품 합격률이 아니다. 미등록/미승인 요건은 별도 **0% 인수**. 코드 상 함수 결과와 실문서 누락·법원 서식 실패 여부는 미관찰.

## 5담당자 보드 체크 ID별 부분 검증 (모두 [ ] 유지)

- **A3-DATA-003**: 20 ID/52슬롯의 source-only·typed·계산·법률·서식·대상/기간·원단위 태그를 정적 조인. 실제 Fact/typed 재독·수정계보 미실행.
- **A3-IT-020**: 직접 소비 0/20이라고 증빙 무용/삭제 처리하지 않음. 85서류 원천 보존/복수행 분리 **정책 선언**만 관찰, 실제 D1/R2 보존/사용처 미지정 큐 미검증.
- **A3-DOC-002**: 근로 문서 4종의 보험자격·계약서 서명·수당/기본급/기간·대상 조합과 이혼증빙 구분. 직군별 요구서류 자동생성, 갈음 B+C, 법원보정 UI/E2E 미관찰.
- **A3-CALC-001**: #314 기본급(급여주기)·#320 근로시간(시간/week)·#303 양육비(원통화/기간)를 다른 금액·실지급/소득에 합산하지 않음. 월평균 계산·세후/공제·공식 양식 미실행.
- **A3-LAW-001**: 자격·지속소득/양육비 의무에 대한 95 법률위험/50규칙/46예외의 정확 승인형 증거계약은 정적 seed 미등록. 운영 참조 기준정보/관할·시행일/변호사 승인/법원 채택 미확인.

## 검증 경계/인수·다음 시작 ID

- 이전 최초 정적 순차 693/693(기존 r35), 이번까지 **재감사 320/693**, A3 보드 124개 **최종 [x] 0개 유지**(반영 후 재조회 필요). 실제 Node 테스트·CI·OCR·D1·R2·Cron·법원 양식·법률 승인·배포 **미인증**.
- 운영배포, 운영 D1 migration, 전자제출, 법원 인가 확정 **미실행**. 법률·계산 의미의 고위험 수정은 별도 실무 검토 대상이며 이번 코드는 변경하지 않음. 진행 중인 Draft PR #51(기간 판정), 관련 계산/Fact PR 미병합 수정과 중복 작업하지 않음.
- **다음 시작 #321 `employment_relationship::income.employment.issue_date` ~ #340**, 시작 역할 **AX담당자**. 문서 발행일·근로시작일과 보증/연대 원천의 부채 계산·법률 인정 경계를 순차 검증.
- 실제 고객 문서·개인정보·원본 OCR 사실값·키/비공개 테스트 정답/.env는 공개 Git 미기록.

## 실제 확인한 주요 소스 blob SHA (2026-11-01 main)

- `lib/canonical-field-id-index.json`: `27ecdddd208de82a2f5c675e7482485e3a8838c2`
- `lib/document-agent-field-contracts.json`: `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`
- `lib/shared-document-field-contracts.json`: `9decab974e0909ae24ad927bdfe241d75b71f3a9`
- `lib/ocr-field-supplements.json`: `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`
- `lib/field-applicability-contracts.json`: `6076b26f782c4643a21a7b2f1a8f6261bb588b68`
- `lib/reference-intake-catalog.json`: `ae6aa4fd2ef11ee0266b5ad05b2f9a96164daa99`
- `lib/reference-decision-tables.json`: `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`
- `lib/risk-catalog.json`: `e96dd0926e3ae9be5a5573d4551538ba294c4d2e`
- `lib/legal-catalog.json`: `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`
- `lib/legal-exceptions.json`: `6e51197226bfd8320e1147d8df3f12c11e00927c`
- `lib/feature-lineage-audit.ts`: `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`
- `lib/canonical-field-binding.ts`: `60ee5c7762d52b72a165b4f4f8214680eb98f148`
- `lib/material-calculation-source-gate.ts`: `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`
- `lib/ocr-chain-matrix.ts`: `977de86ba698bd805cc6b95d1384e3b49d0dbb4c`
- `lib/legal-evidence-criteria.ts`: `6c0b94535700d4fa4d356f8a91d5b9440b5ac52a`
- `lib/shared-document-catalog.ts`: `4cd07ebcc11d2d9d803a117ae98424292e1c5cba`
- `lib/document-agent-registry.ts`: `f2299ff2588be6570ce6493098547b10f66d9fed`
- `db/schema.ts`: `933f8686845ac14669312dd21bf85e02c62ed5e6`
- `docs/ocr-693-field-register.md`: `dfa1a09cf035a07130e2cf40a6b4e7dae44581d4`
