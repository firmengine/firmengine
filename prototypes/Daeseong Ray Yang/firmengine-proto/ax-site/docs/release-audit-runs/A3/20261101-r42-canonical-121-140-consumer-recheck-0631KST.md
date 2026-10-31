# FirmEngine A3 r42 — canonical #121–140 소비처 심층 재감사 (2026-11-01 KST)

> **검증 층위:** GitHub 소스와 계약의 정적 조인, 원본 함수 일부 V8 격리 실행 및 합성 검증만 확인. 실제 OCR 원본·SQL/D1 Fact 저장/재독·typed 소비·Native Node 전체 테스트·CI·staging D1/R2/Cron·공식 법원 Word/e-form·변호사 승인·사이트/운영 배포 **미관찰/미인증**. 공개 Git에 실제 고객 문서/개인정보/원본 OCR 값/키/환경설정/비공개 정답 기록 없음.

## 1. 근거 SHA·전회 인계·역할 회전

- 읽기 당시 최신 `main` HEAD: `c4e664d70e21c85547115baecf5e9634111d6383`. 직전 [r41 #101–120](20261101-r41-canonical-101-120-period-observation-0530KST.md), 과거 [r07 #121–140](20261030-1928-canonical-121-140.md) 및 중앙 단일 인수 보드의 A3 체크 ID를 대조.
- 원본 계약 blob (현재 동일성 확인): canonical index `27ecdddd208de82a2f5c675e7482485e3a8838c2`, family `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`, shared documents `9decab974e0909ae24ad927bdfe241d75b71f3a9`, supplement `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`, applicability `6076b26f782c4643a21a7b2f1a8f6261bb588b68`. 앞서 읽고 검사한 코드 blob: canonical binding `60ee5c7762d52b72a165b4f4f8214680eb98f148`, lineage `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`, material `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`, business identity `73331de276f9bc78e2c9d43fc48e179cf6ba161c`, business-source `0b796d9c3bc608c1224c5f9a049c80b6951a8b74`, net review `60a4fc295943dce404a7f99efffe88f58dd2d4ff`.
- 관련 최신 조사 시 [Draft PR #39](https://github.com/firmengine/firmengine/pull/39)와 [Draft PR #109](https://github.com/firmengine/firmengine/pull/109) **open/미병합**. 두 결함 범위를 코드와 비교했으며 중복 수정 또는 미승인 병합 없음.
- 순환 역할: **변호사 → 데이터담당자 → IT담당자 → 계산사무장 → 사용자·서류담당자**. 보드의 `A3-LAW-015`, `A3-DATA-019`, `A3-IT-020`, `A3-CALC-002`, `A3-DOC-007`을 부분감사, **모두 [ ]**. 다음은 **AX담당자**부터 시작.

## 2. 실제 계약 열거·독립 실행 결과

- canonical 정확 **693/693 고유**, 증빙 **85종**, 가족 **48개**, document×family×field source route **1,808**, 중복 0, 인덱스 밖 route 0. #121–140은 **20 ID / 78 route / 9종 증빙**, 78/78 source record `noCrossRecordBorrowing=true` **선언**. 동일 ID 여러 서류 사용은 여러 독립 고객 사실을 증명하지 않음.
- 적용조건 등록 **19/20**, 정확 미등록 **#140**. `canonicalProjectionKey` 선언 직접 typed **4개**(#129 income.label, #132 income.gross, #134 income.period_end, #135 income.period_start), material `must_reconcile` **#132→income.gross** 1개, context_only 0. 정확 공식 `OCR_DECLARED_FORM_TARGETS` token **0/20**, 95위험·50법률규칙·46예외의 *정확 canonical ID* JSON 직접 인용 **0/20**. `LEGAL_EVIDENCE_POLICY_SEED.checks=[]`이나 실제 관리 기준정보/변호사 승인과 동의어 아님.
- `reference-decision-tables.json`에서 18계산/91입력 선언(78 고유 입력, 42 출력)을 실제 집계. `feature-lineage-audit.ts`의 원본 `hasPeriod()/hasUnit()` 표현식을 JS V8로 추출해 **각 20개 2회, 총 40회 실행**. 역할 `not_applicable`인데 패밀리명으로 기간 필수 true가 된 건 **이번 구간 0건**. 실제 문서/page/복수행/대상·단위·기간의 OCR 성공은 시험하지 않음.
- 원본 계약 및 20개 field별 원천·메타데이터·소비처 **정적 독립 검사 76/76 기대 일치**. 이어 재검산한 원천 인덱스·증빙·route 등 **12/12 불변식 일치**. 이는 실제 고객 처리/법률 합격률 아님.
- 기존 P1 재검증: `business-identity-crosswalk.ts valid()` 원본을 타입만 제거하여 V8 격리, `factSourceLineageIssues`는 empty stub. 가상 사업자번호의 원문 `rawValue`와 보유 `value`가 서로 다른데도 `true`로 판정되어 **4개 입력 중 1개 독립 기대와 불일치(3/4)**. 실제 사업자번호/개인정보는 사용하지 않았으며 [Draft PR #39](https://github.com/firmengine/firmengine/pull/39)의 기존 수정 검토를 우선.

## 3. ID별 증거·DB/typed·계산·법률·양식 소비 및 공백

표의 타입/단위/기간·대상은 **스키마 선언**이며, 각 행의 실제 원문·페이지·복수행·문서해시·사실값·DB Fact/typed 값은 **미관찰**. DB `extraction_records`/`extracted_features`/`extraction_field_coverage` 저장·조회 **코드 존재**만 확인. typed는 **변환 선언**, 원천 검토는 **source-only 후보**, 공식 법률 필수/양식 승인이 아님.

| # | Canonical ID | 원천 슬롯 | 타입 / 원단위 | 기간 / 대상 | 적용조건 | 직접 typed | 실제 소스/검산 및 미승인 소비처 |
|---:|---|---:|---|---|---|---|---|
| 121 | `business_registration::business_items` | 4 | string / not_applicable | not_applicable / business_entity | 등록 | — | 사업종목: 사업자·사업범위 원문 맥락(자동 소득인가 금지) |
| 122 | `business_registration::business_type` | 4 | string / not_applicable | not_applicable / business_entity | 등록 | — | 사업유형: 사업소득 분류·역질문 |
| 123 | `business_registration::issue_date` | 4 | date / source date format normalized to ISO without loss | document_issue_date / business_entity | 등록 | — | 증명 발급일: 개업/등록/신고일과 분리 |
| 124 | `business_registration::joint_operators` | 4 | party_role / not_applicable | not_applicable / business_entity | 등록 | — | 공동사업자: 명의·귀속 비율 추가검토, PR #39 |
| 125 | `business_registration::opening_date` | 4 | date / source date format normalized to ISO without loss | effective_date / business_entity | 등록 | — | 개업일: 실제 영업기간 검토 |
| 126 | `business_registration::registration_date` | 4 | date / source date format normalized to ISO without loss | registration_effective_date / business_entity | 등록 | — | 등록 효력일: 개업일과 별개 |
| 127 | `business_registration::representative` | 4 | party_role / not_applicable | not_applicable / business_entity | 등록 | — | 대표자: business-identity-crosswalk 검토 |
| 128 | `business_registration::status` | 4 | category / not_applicable | not_applicable / business_entity | 등록 | — | 영업상태: 사업자번호 누락시 review 후보 유실 PR #39 |
| 129 | `business_sales_vat::income.sales.business_entity` | 4 | party_role / not_applicable | not_applicable / business_entity | 등록 | income.label | VAT 원천 사업체: typed income.label·사업체 동일성 검토 |
| 130 | `business_sales_vat::income.sales.exempt_sales` | 4 | money / KRW | period_scope / business_entity | 등록 | — | 면세매출: business-source turnover_component |
| 131 | `business_sales_vat::income.sales.filing_date` | 4 | date / not_applicable | application_filing_date / business_entity | 등록 | — | 부가세 신고일: 신고/귀속기간 분리 |
| 132 | `business_sales_vat::income.sales.gross_sales` | 4 | money / KRW | period_scope / business_entity | 등록 | income.gross | 총매출: typed income.gross·material must_reconcile→income.gross; business-source turnover_total |
| 133 | `business_sales_vat::income.sales.issue_date` | 4 | date / not_applicable | document_issue_date / authority | 등록 | — | 증명 발급일: 과세기간과 분리 |
| 134 | `business_sales_vat::income.sales.reporting_period_end` | 4 | date / not_applicable | statement_period_end / business_entity | 등록 | income.period_end | 귀속기간 종료: typed income.period_end·net preflight |
| 135 | `business_sales_vat::income.sales.reporting_period_start` | 4 | date / not_applicable | statement_period_start / business_entity | 등록 | income.period_start | 귀속기간 시작: typed income.period_start·net preflight |
| 136 | `business_sales_vat::income.sales.returns_refunds` | 4 | money / KRW | period_scope / business_entity | 등록 | — | 환불/반품: returns_refunds 검산(조정 미승인시 보류) |
| 137 | `business_sales_vat::income.sales.sales_count` | 4 | integer / transactions | period_scope / business_entity | 등록 | — | 매출 거래건수: 수량 검산, 원화 합산 금지 |
| 138 | `business_sales_vat::income.sales.taxable_sales` | 4 | money / KRW | period_scope / business_entity | 등록 | — | 과세매출: turnover_component, 총매출과 중복합산 금지 |
| 139 | `business_sales_vat::income.sales.vat_collected` | 4 | money / KRW | period_scope / business_entity | 등록 | — | 매출 VAT: vat_collected, 순소득 자동 가감 금지 |
| 140 | `card_statement::billed_amount` | 2 | money / source currency/unit | not_applicable / document_subject | **미등록** | — | 월 카드청구액: 채무원금 아님·통화/청구기간 원천 검토·적용조건 미등록 |

- **사업등록 #121–128**: `business_status_evidence`, `business_registration`, `business_contract`, `closure_certificate` 각 8필드. 발급·개업·등록 날짜와 대표/공동사업자·영업상태를 구분하고, 소유지분·사업자번호 누락 시 역질문 필요. 실무자 승인 전 신청인 귀속 소득으로 승격하지 않음.
- **VAT 매출 #129–139**: `business_income_report`, `vat_certificate`, `vat_exempt_certificate`, `sales_purchase_summary` 각 11필드. #132 총매출(`must_reconcile`)과 #130 면세/#138 과세 구성, #136 환불, #139 VAT, #137 거래 건수는 **절대 자동 중복합산하지 않음**. `business-source-evidence.ts`는 turnover_total/component/returns_refunds/vat_collected를 구분, `business-net-reconciliation.ts`는 원천 기간·사업자·비용범주·사람 승인 및 기준정보를 별도 대조. `must_reconcile` ≠ 승인된 현재 월 순소득.
- **카드 #140**: `card_statement` 문서의 `debt_certificate` 및 `bank_transactions` 가족에서 2슬롯. 원천 `semantic_source_rule`는 있지만 `field-applicability-contracts.json`의 **정확 `card_statement::billed_amount` ID가 없어서 적용조건 정책등록 합격 0%**. 현 청구액과 현재 확정 채무원금은 다르며 통화·청구기간·할부·원거래·채무자·중복건을 확인해야 함. source-only와 법률 인가를 분리, 무단 KRW 환산·삭제 금지.
- **법률/서식/갈음·법원보정**: 전체 법률위험95·규칙50·예외46 및 서식·갈음·법원보정 **코드/계약만 조회**. 해당 20 ID의 정확 승인 법률·공식 서식 token 0을 증빙 무용이나 인가 요건 충족으로 간주하지 않음. 실증 B+C 갈음 승인, 법원 보정명령 원문/기한/접수영수증, official Word diff, D1 재투영 및 승인된 조건부 필요한 서류는 **모두 미관찰**.

## 4. 발견·미해결 결함 및 다음 인수

1. **기존 P1 [Draft PR #39](https://github.com/firmengine/firmengine/pull/39)**: 사업자번호·사업체 원문 상충의 원천검증 거짓 양성, 사업자번호 미기재시 등록상태/공동사업자 맥락 누락 및 로컬 subject ID의 문서간 충돌. V8 원본 반례 재현, Node/CI 및 실사건 검증 없음. Draft 유지.
2. **이번 P2 #140**: 카드 월청구액의 정확 적용조건 등록 누락 1건. 유사 문서의 정책이 곧 승인된 본 필드 정책은 아니며, 법률/서류 담당자가 원문조건·기간·필수 여부·승인/기준정보 정책을 검토해야 함. 임의 코드 수정 보류.
3. **기존 P1 [Draft PR #109](https://github.com/firmengine/firmengine/pull/109)**: #132의 사업매출 귀속기간이 미관찰/상충인데 과거로 빠지는 기간 검토 우회 가능성. 원천 사실 미관찰/null/관측0/비해당/상충/승인전 상태 독립 유지, 현재 소득 0 자동 확정 금지.
4. **source-only 보존**: 16개 direct typed 미선언을 삭제·무용 판정하지 않음. 사업체 식별·매출검산·금액중복·거래/기간 대조와 법률 근거 요구의 후속 인적 큐로 남음.
5. **보드 5 ID 부분 [ ]**: `A3-LAW-015` 법률 승인 근거 부재, `A3-DATA-019` #140 미등록, `A3-IT-020` 직접 소비처 부재 증거 보존, `A3-CALC-002` 총매출/VAT/환불 경계, `A3-DOC-007` 등록증·VAT 서류·카드 원문 기간/대상·갈음 검토. 모두 정적/합성만 검증.

**다음 시작**: canonical **#141 `card_statement::billing_period`**, 범위 #141–160, 역할은 **AX담당자부터**. 최초 정적 조사 693/693, 소비처 심층 재감사 **140/693**, A3 전체 보드 124 ID의 최종 [x] 0건. 운영 배포·D1 운영 마이그레이션·전자제출·법원 인가 확정 **실행하지 않음**.
