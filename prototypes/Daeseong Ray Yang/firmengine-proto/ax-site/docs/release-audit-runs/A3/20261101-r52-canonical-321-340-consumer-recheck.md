# FirmEngine A3 r52 — canonical OCR #321–340 소비처 심층 재감사 (2026-11-01 KST)

## 기준 main / 실행·인수 경계
- 확인 `main` HEAD (영수증 작성 직전): `9c382a8b721b684cec38be35102041acb641efde`. 작업 허용 범위는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래로 고정.
- 단일 인수 기준: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`의 A3 **124개 ID (IT20/DOC20/CALC20/LAW22/DATA22/AX20)**. 직전 r51 #301–320과 이전 최초 r17 #321–340, 최신 스키마·원본 코드·테스트를 읽고 독립 재검증.
- 역할 순환 **AX → IT → 사용자·서류 → 계산사무장 → 변호사**, 선택한 ID **A3-AX-019, A3-IT-017, A3-DOC-004, A3-CALC-015, A3-LAW-005**. 모두 **[ ] 미완료** 유지; 다음 회차 **데이터담당자** 시작.
- 공개 Git에 실제 사건·원문 OCR·고객 개인정보·키/.env·비공개 정답은 저장하지 않음. synthetic/V8 및 정적 메타데이터만 사용.
- 이 영수증의 '일치'는 **정적 데이터 계약 / TypeScript 술어 원본문을 격리한 JavaScript 실행**이다. 프로젝트 Node 테스트, 전체 CI, OCR 실제 파일, D1/R2/Cron, 실 Word/공식 서식, 변호사 승인·법원 결정·사이트/운영 배포 **미검증**.
- 관련 미병합 Draft [PR #131](https://github.com/firmengine/firmengine/pull/131): 건강보험 체납의 자산 서식 검토 후보 과잉을 분리 수정·회귀 작성, **main 미반영**. 기존 동일 함수 수정 후보 #51/#56/#59와 병합 전 충돌 검토.

## 근거 소스 및 최신 blob SHA
| 코드·계약 | blob SHA |
|---|---|
| `lib/canonical-field-id-index.json` | `27ecdddd208de82a2f5c675e7482485e3a8838c2` |
| `docs/ocr-693-field-register.md` | `dfa1a09cf035a07130e2cf40a6b4e7dae44581d4` |
| `lib/document-agent-field-contracts.json` | `9884b3fecf44643fefcdc4a421ed66ffc5477b3a` |
| `lib/shared-document-field-contracts.json` | `9decab974e0909ae24ad927bdfe241d75b71f3a9` |
| `lib/ocr-field-supplements.json` | `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5` |
| `lib/field-applicability-contracts.json` | `6076b26f782c4643a21a7b2f1a8f6261bb588b68` |
| `lib/module-contracts.generated.json` | `46a395a763ac17ab8e66c492c26c8e20fc037f56` |
| `lib/feature-lineage-audit.ts` | `de81bc3b8c460b8a4dde3fda9e13087e619e74ff` |
| `lib/material-calculation-source-gate.ts` | `0286b44484913b63fa8ec3f7bf0ca59b034d0dab` |
| `lib/ocr-chain-matrix.ts` | `977de86ba698bd805cc6b95d1384e3b49d0dbb4c` |
| `db/schema.ts` | `933f8686845ac14669312dd21bf85e02c62ed5e6` |
| `lib/legal-evidence-criteria.ts` | `6c0b94535700d4fa4d356f8a91d5b9440b5ac52a` |
| `lib/extraction-row-store.ts` | `ec3f6b9d3ad8bf5f9ce4419a6816fadede378125` |
| `lib/reference-case-projection.ts` | `92cb5fd5816571259e070490a496e7b7f4d8515c` |

## 검증 결과 (정적 29/29 기대 일치 + 원본 기간/단위 40/40 + PR 수정 후보 V8 7/7)
| 검증 항목 | 독립 기대 | 실제 관찰 | 구분 |
|---|---:|---:|---|
| canonical IDs | 693 | 693 | 일치 |
| register numbered rows | 693 | 693 | 일치 |
| register/index exact number and ID matching | 693 | 693 | 일치 |
| registered source slots | 1808 | 1808 | 일치 |
| documents | 85 | 85 | 일치 |
| base OCR families | 48 | 48 | 일치 |
| unique index IDs | 693 | 693 | 일치 |
| source index IDs | 693 | 693 | 일치 |
| orphan IDs | 0 | 0 | 일치 |
| scope IDs | 20 | 20 | 일치 |
| scope source slots | 34 | 34 | 일치 |
| scope distinct documents | 7 | 7 | 일치 |
| scope exact applicability | 20 | 20 | 일치 |
| scope exact direct typed-mapped (base module declaration) | 0 | 0 | 일치 |
| scope exact direct form target | 0 | 0 | 일치 |
| scope context_only material | 1 | 1 | 일치 |
| scope must_reconcile material | 1 | 1 | 일치 |
| scope risk explicit required_features | 0 | 0 | 일치 |
| scope route metadata mismatch | 0 | 0 | 일치 |
| scope routes with sourceOnly/row isolation | 20 | 20 | 일치 |
| calculation modules | 18 | 18 | 일치 |
| calculation input occurrences | 91 | 91 | 일치 |
| legal risk catalog | 95 | 95 | 일치 |
| legal rules | 50 | 50 | 일치 |
| legal exception scenarios | 46 | 46 | 일치 |
| material source contract entries | 29 | 29 | 일치 |
| board A3 IDs | 124 | 124 | 일치 |
| board unique A3 IDs | 124 | 124 | 일치 |
| board A3 finished | 0 | 0 | 일치 |

- 위 등록 693개는 `lib/canonical-field-id-index.json`과 `docs/ocr-693-field-register.md` 번호·ID **693/693 정확 일치**. 기존 순차 정적 693/693과 심층 재감사 340/693은 다른 의미.
- 이번 **20개 / 34 원천 슬롯 / 7서류 / 3패밀리**. E=근로관계 2×4=8, G=보증·연대 8×2=16, H=건강보험 체납 10×1=10. 원천 슬롯은 관측된 OCR 값이 아님.
- 정확 적용조건 등록 **20/20**은 필드 원천 적용설명만 의미. 법률 필수요건·관할·시행일·변호사 승인 **0개 인증**.
- 모든 20개에서 **typed 직접 0, 정확 18계산 입력 경로 0, 공식 서식 직접 token 0, 정확 법률 위험 필수증거 계약 0**. 원천 증거·비합산 검산·역질문 가치를 유지. 계약 0은 실제 소비처 절대부재·폐기허용 의미가 아님.
- 금액 원천 `#326`은 `context_only`, `#340`은 `must_reconcile→debt.principal` **선언**만 확인. 직접 CaseData typed 0. 실제 Fact 연결·산식 실행·원본 인용 확인·법률상 채권분류 전에는 금액 인정 금지.
- 법률 `risk-catalog.json` **95**, `legal-catalog.json` **50 rules**, `legal-exceptions.json` **46**; 정확 OCR ID 승인형 evidence policy `LEGAL_EVIDENCE_POLICY_SEED.checks=[]` 여부 정적 확인. 실제 승인된 외부 참조값/관할·시행일·운영 저장본·법률 검토는 **미조회**.

## #321–340 실제 원천/단위/기간/대상/소비처/공백 표
- E: `income_source_inventory`, `employment_certificate`, `employment_contract`, `employment_history` @ `employment_relationship`.
- G: `loan_contract`, `guarantee_contract` @ `guarantee_joint_claim`.
- H: `social_insurance_arrears` @ `health_insurance_arrears`.
- 세 원천군 모두 각 문서의 `recordPolicy.sourceOnly=true` · `noCrossRecordBorrowing=true`, 원본 field `required_source_anchor`는 문서 해시/페이지/원문 quote/bbox/동일행 범위를 **요구한다고 선언**. 실제 페이지·행·문서 ID·환산 원통화 값/대상자 Fact는 **0건 관측**.
- 각 행의 직접 typed/18산식키/확정 공식 토큰/승인 법률 evidence ID는 정확 매핑 **0/0/0/0**. **P/U**는 실제 `hasPeriod`/`hasUnit`의 타입 주석만 제거한 원본문 V8 결과.
| # | Canonical ID | 문서/패밀리 (슬롯) | 타입 / 원단위 / 시간역할 / 주체 | 적용조건 | P/U | material 소비 선언 | 증거·검산·역질문 경계 |
|---:|---|---|---|---|---|---|---|
| 321 | `employment_relationship::income.employment.issue_date` | E / 4 | date; not_applicable; document_issue_date; issuer | 등록 (원천조건) | Y/N | 정확연결 0 | 발급일/효력일 혼동 금지 |
| 322 | `employment_relationship::income.employment.start_date` | E / 4 | date; not_applicable; effective_date; applicant_debtor | 등록 (원천조건) | Y/N | 정확연결 0 | 실제 근로시작·입금기간 별도 |
| 323 | `guarantee_joint_claim::applicant_role` | G / 2 | category; not_applicable; not_applicable; applicant_debtor | 등록 (원천조건) | N/N | 정확연결 0 | 보증인/연대/주채무자 책임 구별 |
| 324 | `guarantee_joint_claim::creditor` | G / 2 | party_role; not_applicable; not_applicable; applicant_debtor | 등록 (원천조건) | N/N | 정확연결 0 | 채권자와 원채권 증빙 일치 검토 |
| 325 | `guarantee_joint_claim::dispute_status` | G / 2 | category; not_applicable; not_applicable; applicant_debtor | 등록 (원천조건) | N/N | 정확연결 0 | 다툼은 확정채무 아님 |
| 326 | `guarantee_joint_claim::guarantee_claimed` | G / 2 | money; currency and exact source unit if monetary; not_applicable; applicant_debtor | 등록 (원천조건) | N/Y | context_only→∅ | 조건부 보증청구액, 원채무 중복 금지 |
| 327 | `guarantee_joint_claim::guarantee_limit` | G / 2 | money; currency and exact source unit if monetary; not_applicable; applicant_debtor | 등록 (원천조건) | N/Y | 정확연결 0 | 보증한도≠현재 확정 원금 |
| 328 | `guarantee_joint_claim::principal_debtor` | G / 2 | party_role; not_applicable; not_applicable; applicant_debtor | 등록 (원천조건) | N/N | 정확연결 0 | 주채무자-신청인 주체 구분 |
| 329 | `guarantee_joint_claim::recourse_status` | G / 2 | category; not_applicable; not_applicable; applicant_debtor | 등록 (원천조건) | N/N | 정확연결 0 | 구상권 인정 별도 법률검토 |
| 330 | `guarantee_joint_claim::underlying_claim_id` | G / 2 | identifier; not_applicable; not_applicable; applicant_debtor | 등록 (원천조건) | N/N | 정확연결 0 | 기초채권 연결·중복 제거 후보 |
| 331 | `health_insurance_arrears::as_of_date` | H / 1 | date; source date format normalized to ISO without loss; balance_as_of_date; subscriber | 등록 (원천조건) | Y/N | 정확연결 0 | 채무잔액 기준일 |
| 332 | `health_insurance_arrears::authority` | H / 1 | party_role; not_applicable; not_applicable; subscriber | 등록 (원천조건) | N/N | 정확연결 0 | 발급기관≠납부자 |
| 333 | `health_insurance_arrears::disposal_cost` | H / 1 | money; currency and exact source unit if monetary; not_applicable; subscriber | 등록 (원천조건) | N/Y | 정확연결 0 | 처분비·본금 분리 |
| 334 | `health_insurance_arrears::issue_date` | H / 1 | date; source date format normalized to ISO without loss; document_issue_date; subscriber | 등록 (원천조건) | Y/N | 정확연결 0 | 발급일/효력일 혼동 금지 |
| 335 | `health_insurance_arrears::late_charge` | H / 1 | money; currency and exact source unit if monetary; not_applicable; subscriber | 등록 (원천조건) | N/Y | 정확연결 0 | 연체금≠본금 |
| 336 | `health_insurance_arrears::period_end` | H / 1 | date; source date format normalized to ISO without loss; statement_period_end; subscriber | 등록 (원천조건) | Y/N | 정확연결 0 | 부과기간 종료 |
| 337 | `health_insurance_arrears::period_start` | H / 1 | date; source date format normalized to ISO without loss; statement_period_start; subscriber | 등록 (원천조건) | Y/N | 정확연결 0 | 부과기간 시작 |
| 338 | `health_insurance_arrears::subscriber` | H / 1 | party_role; not_applicable; not_applicable; subscriber | 등록 (원천조건) | N/N | 정확연결 0 | 가입자/납부자 동일성 |
| 339 | `health_insurance_arrears::total_arrear` | H / 1 | money; currency and exact source unit if monetary; not_applicable; subscriber | 등록 (원천조건) | N/Y | 정확연결 0 | 합계와 세부항목 이중산입 금지 |
| 340 | `health_insurance_arrears::unpaid_contribution` | H / 1 | money; currency and exact source unit if monetary; not_applicable; subscriber | 등록 (원천조건) | N/Y | must_reconcile→debt.principal | must_reconcile; 법적 우선순위 별도 |

## 원본 술어 및 독립 기대/실관찰
- `hasPeriod(role,family)`: 입력 20개 각 원천의 정확 `temporal_role`과 해당 family. 독립 기대는 원본 계약의 `not_applicable` 제외, 예상 Y=6/N=14. **실제 Y=6/N=14, 20/20 일치**.
- `hasUnit(type)`: 입력 20개 각 `datatype`; 계약상 금액 6개만 unit 검사를 요구. 독립 기대 Y=6/N=14. **실제 Y=6/N=14, 20/20 일치**.
- `reviewScope(family)` 원본문 V8: employment→`D5103,D5110`, guarantee→`D5106,D5110`, health-insurance-arrears→**`D5101,D5106,D5110`**. 마지막 `D5101`은 `insurance` 문자열 때문에 생기는 **P2 자산 검토 후보 과잉**. 정식 법원 제출/토큰 생성까지 수행한 증거는 아님.
- [Draft PR #131](https://github.com/firmengine/firmengine/pull/131)에서는 `health_insurance_arrears` 정확 패밀리만 asset 후보에서 제외하고 `D5106,D5110` 유지. 합성 **V8 7/7** (현행 오류 재현/수정 제외/채무폼 유지/보험정책자산 유지/비대상 3개 변화 없음). 실제 Node 회귀 **테스트 파일 작성만**, Node 실행·CI **미실행**. PR 변경 파일 2개 모두 ax-site 내부. 병합 전 실무자 법률·서식 의미 검토 필수.
- **P2 추가 검토**: #331 잔액 기준일, #334 발급일, #336~337 부과기간은 기간 플래그 Y이나 #333/#335/#339/#340 금액은 N. 같은 원천행·대상·부과기간이 충분히 연결되는지는 정적 선언만 확인, D1 실제 합성/운영 행 검산 **미실행**.
- **금액 이중계상 금지**: #339 총체납·#340 미납보험료·#335 연체가산·#333 처분비는 총계와 구성요소일 수 있으며 #326 보증청구/원채무/보증한도 #327도 서로 다른 계정. 원문 단위·동일 채무 식별자·사람 인정 없이 무단 원화합산 금지. `null`/미관찰/`0`/비해당/상충/source-only/승인전 상태를 결합하거나 자동 확정하지 않음.
- **SQL 저장 계약**: `extraction_records` → `extracted_features(canonical_field_id, raw_value_json, source_state, unit, quote, bbox_json, record_id, ordinal)` 및 `extraction_field_coverage`. `extraction-row-store.ts`의 `sourceOnly:true` 저장/재조회 코드, `reference-case-projection.ts`의 정확 매핑, `material-calculation-source-gate.ts`의 금액 검산, `case-requirement-field-plan.ts`·`document-substitution.ts`·`preapproval-correction-item-store.ts`의 상담 요구/갈음·법원보정 수동 경로를 코드 조회. **실제 D1 행·R2 원문/법원 보정명령/갈음승인·문서 출력 미조회**.

## 5역할 A3 인수 체크 ID (전부 [ ] 미완료)
| ID | 입력·독립 기대 | 관찰 | 인수 잔여 |
|---|---|---|---|
| **A3-AX-019** | 보증금액·한도·본채무 및 건강보험 총계/분할 수치의 의미 혼용 방지 | 20 ID/34슬롯 메타데이터 분리, `reviewScope` 과잉 자산후보 재현·Draft #131 | 실제 OCR/분류기·법률/계산 승인, Node/CI |
| **A3-IT-017** | source-only 피처라도 원문 해시/행/페이지가 이어져야 함 | 7문서 `recordPolicy`, `extracted_features`/원천 해시 필드 정적 확인 | 실 DB/R2 원문 hash/quote/bbox 재독·거절 테스트 |
| **A3-DOC-004** | 보증/연대/주채무자·채권자·채무원인별 원문/서류요구 | 8피처×2서류=16 원천 슬롯, 갈음 검토 경로 존재 | 사건별 서류요구/대상자/대체증빙·법원보정 E2E |
| **A3-CALC-015** | 총체납 vs 미납본금/연체/비용·보증/원채무 이중계상 차단 | context_only #326, must_reconcile #340, typed 직접 0 확인 | 합성 Fact/실 계산/원통화 환산·법원 공식 양식 대조 |
| **A3-LAW-005** | 보증·구상권/다툼 및 체납 채권 성격의 법적 분기 | seed checks=[], 위험95/규칙50/예외46 정적 대조; candidate≠승인 | 관할·시행일/공식 출처·변호사 독립 검토 |

## 누적 및 다음 시작
- 최신 main 정적 인덱스/등록표 693/693, 중복·고아 0; 심층 소비처 재감사 **340/693 (49.1%)**, 잔여 **353**.
- A3 인수 체크 **124개 전부 [ ]**. 일부 정적/원본 술어 검증만 완료; 0건 최종 승인. 실 Node·CI·실 OCR/DB·법원 서식·변호사 검수·사이트 배포는 0건 본 회차 인증.
- **다음 시작 #341 `household_composition_support::household.support.member` → #360**, 다음 역할 시작 **데이터담당자**. 가족/소득의 동일 대상·기준일·실지급/청구비/생계비 이중계상과 갈음/보정을 확인한다.
- **운영 배포·D1 운영 migration·전자제출·법원 인가 확정 미실행**. main 제품 코드는 변경하지 않음; 코드 후보는 별도 Draft #131에만 존재.
