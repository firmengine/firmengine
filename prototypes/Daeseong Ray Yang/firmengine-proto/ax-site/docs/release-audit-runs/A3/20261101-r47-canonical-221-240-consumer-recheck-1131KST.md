# FirmEngine A3 r47 — canonical OCR #221–240 소비처 재감사 (2026-11-01 KST)

## 1. 검증 경계 및 실제 수행
- 시작 `main` HEAD: `9b745191555c5ccf0012ae4f16cb48f5850494bb`. 인수 기준: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`; 직전 r46 #201–220 영수증과 이전 r12 #221–240 영수증, 현재 main 및 기존 Draft PR #56/#51 대조. 변경 허용 범위는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부.
- 역할 순환 **AX담당자 → IT담당자 → 데이터담당자 → 계산사무장 → 변호사**; 해당 보드 체크 **A3-AX-012, A3-IT-007, A3-DATA-019, A3-CALC-005, A3-LAW-003** 모두 **[ ] 부분**, 완료 처리 0. 다음 회차는 **사용자·서류담당자** 시작.
- 실제 최신 인덱스에서 **canonical 693개를 원본 순서대로 열거**, 85서류/48 OCR family/base·shared 확장·supplement를 전수 결합해 **1,808개 선언 슬롯**, 누락·고아 0건을 확인. 18개 계산/91 선언 입력/78고유 입력, 법률위험95·규칙50·예외46의 앞서 확인한 원본 계약 규모를 유지.
- 이번 **20개 ID / 20개 선언 슬롯 / 3개 서류**. 개별 문서해시·페이지·원문 인용·bbox·복수행 record identity 및 대상자 분리 계약 20/20 선언 확인. `noCrossRecordBorrowing=true` 및 `sourceOnly=true` 20/20. 실제 원천 PDF/DB Fact 및 보정결과 읽기는 하지 않았음.
- 이번 독립 JS 구조·함수 **22/22개 단언 기대 일치**; 원본 `lib/feature-lineage-audit.ts`에서 추출한 `hasPeriod`·`hasUnit` 표현식 각각 **20회**, `reviewScope` 본문을 V8 격리 실행. **합성·정적 계약 검증**이지 프로젝트 Node 테스트, 전체 CI, staging D1/R2/Cron, 공식 서식/변호사 승인 또는 운영 배포 합격이 아님.

## 2. 개별 원천 및 모든 직접 소비처/공백

마지막 열 순서: **직접 typed / material calculation / 정확 공식서식 token / 승인된 정확 법률 증거계약**. 이번 20 ID 전부 0건 선언; 이는 원천 증거 무용 또는 자동 폐기를 뜻하지 않음. 기간/단위 `P/U`는 원본 술어 실행 결과이며 정책·법적 인정 결과가 아님.

| # | canonical ID | 실제 서류 / OCR family | datatype; 원단위 | temporal_role; subject_role | 정확 적용조건 | P/U | typed/calc/form/law |
|---:|---|---|---|---|---|---|---|
| 221 | `credit_report::currency_unit` | `credit_information_report` / `credit_report` | string; not_applicable | not_applicable; applicant_debtor | 등록(미승인) | N/N | 없음/없음/없음/없음 |
| 222 | `credit_report::event_date` | `credit_information_report` / `credit_report` | date; source date format normalized to ISO without loss | event_date; applicant_debtor | 등록(미승인) | Y/N | 없음/없음/없음/없음 |
| 223 | `credit_report::event_kind` | `credit_information_report` / `credit_report` | category; not_applicable | not_applicable; applicant_debtor | 등록(미승인) | N/N | 없음/없음/없음/없음 |
| 224 | `credit_report::institution` | `credit_information_report` / `credit_report` | party_role; not_applicable | not_applicable; applicant_debtor | 등록(미승인) | N/N | 없음/없음/없음/없음 |
| 225 | `credit_report::product_code` | `credit_information_report` / `credit_report` | string; not_applicable | not_applicable; applicant_debtor | 등록(미승인) | N/N | 없음/없음/없음/없음 |
| 226 | `credit_report::reported_amount` | `credit_information_report` / `credit_report` | money; currency and exact source unit if monetary | not_applicable; applicant_debtor | 등록(미승인) | N/Y | 없음/없음/없음/없음 |
| 227 | `credit_report::status` | `credit_information_report` / `credit_report` | category; not_applicable | not_applicable; applicant_debtor | 등록(미승인) | N/N | 없음/없음/없음/없음 |
| 228 | `creditor_assignment_dispute::assignment_date` | `assignment_notice` / `creditor_assignment_dispute` | date; source date format normalized to ISO without loss | not_applicable; claim_obligor | 등록(미승인) | N/N | 없음/없음/없음/없음 |
| 229 | `creditor_assignment_dispute::claim_id` | `assignment_notice` / `creditor_assignment_dispute` | identifier; not_applicable | not_applicable; claim_obligor | 등록(미승인) | N/N | 없음/없음/없음/없음 |
| 230 | `creditor_assignment_dispute::claim_status` | `assignment_notice` / `creditor_assignment_dispute` | category; not_applicable | not_applicable; claim_obligor | 등록(미승인) | N/N | 없음/없음/없음/없음 |
| 231 | `creditor_assignment_dispute::current_claimant` | `assignment_notice` / `creditor_assignment_dispute` | party_role; not_applicable | not_applicable; claim_obligor | 등록(미승인) | N/N | 없음/없음/없음/없음 |
| 232 | `creditor_assignment_dispute::dispute_basis` | `assignment_notice` / `creditor_assignment_dispute` | string; not_applicable | not_applicable; claim_obligor | 등록(미승인) | N/N | 없음/없음/없음/없음 |
| 233 | `creditor_assignment_dispute::disputed_amount` | `assignment_notice` / `creditor_assignment_dispute` | money; currency and exact source unit if monetary | not_applicable; claim_obligor | 등록(미승인) | N/Y | 없음/없음/없음/없음 |
| 234 | `creditor_assignment_dispute::notice_date` | `assignment_notice` / `creditor_assignment_dispute` | date; source date format normalized to ISO without loss | event_date; claim_obligor | 등록(미승인) | Y/N | 없음/없음/없음/없음 |
| 235 | `creditor_assignment_dispute::prior_creditor` | `assignment_notice` / `creditor_assignment_dispute` | party_role; not_applicable | not_applicable; claim_obligor | 등록(미승인) | N/N | 없음/없음/없음/없음 |
| 236 | `creditor_assignment_dispute::supporting_record` | `assignment_notice` / `creditor_assignment_dispute` | identifier; not_applicable | not_applicable; claim_obligor | 등록(미승인) | N/N | 없음/없음/없음/없음 |
| 237 | `crypto_balance::account_owner` | `crypto_balance` / `cash_deposit_asset` | party_role; not_applicable | not_applicable; document_subject | 미등록(0% 합격) | N/N | 없음/없음/없음/없음 |
| 238 | `crypto_balance::asset_symbol` | `crypto_balance` / `cash_deposit_asset` | string; not_applicable | not_applicable; document_subject | 미등록(0% 합격) | N/N | 없음/없음/없음/없음 |
| 239 | `crypto_balance::available_quantity` | `crypto_balance` / `cash_deposit_asset` | quantity; asset-native unit | not_applicable; document_subject | 미등록(0% 합격) | N/Y | 없음/없음/없음/없음 |
| 240 | `crypto_balance::average_acquisition_price` | `crypto_balance` / `cash_deposit_asset` | money; source quote currency/asset unit | not_applicable; document_subject | 미등록(0% 합격) | N/Y | 없음/없음/없음/없음 |

- 적용조건은 **16/20**, 누락 **#237–240 4개**(가상자산 확장 canonical을 `cash_deposit_asset` family로 라우팅하나 그 family의 정확 `field-applicability-contracts.json` 등록에 없음). 네 개의 미등록 조건은 **0% 합격**. 자동 등록·삭제·법률상 필요조건 간주 금지.
- DB 소스 계약 `db/schema.ts`와 `lib/extraction-row-store.ts`는 `extraction_records`, `extracted_features`, `extraction_field_coverage`·`canonical_field_id`·`raw_value_json`·`source_state`·quote·bbox를 선언. 정확 20개에서 직접 typed 0, material `must_reconcile`/ `context_only` 0, `OCR_DECLARED_FORM_TARGETS` 정확 token 0. 이는 실 Fact 저장·재독/산식 실행을 보증하지 않음.
- `lib/legal-evidence-criteria.ts`의 `LEGAL_EVIDENCE_POLICY_SEED.checks=[]`. 원본 법률위험 95/법률규칙50/예외46 목록의 정확 canonical 리터럴 직접계약은 0/20로 앞선 감사와 일치. **법률승인된 증거 0%**; 법원 관할·판본·시행일과 변호사/법원 인가 전 확정 금지. 일반 family 법률/서식 **검토 후보**를 정확 승인된 연결로 오인 금지.
- `docs/substitution-coverage-matrix.json`에서 `credit_information_report`, `assignment_notice`, `crypto_balance` 모두 `primary_required_no_auto_substitution` 선언. 실제 갈음 B+C 승인·법원 보정 및 제출확인, 실제 공식 D5101/D5106/D5110에 인용된 출력은 미관찰.

## 3. 실제 발견한 공백·반례 및 후속 검토
1. **P2 적용조건 미등록 4건**: #237 소유자, #238 종목, #239 가용수량, #240 평균취득단가. 정확 라우트는 모두 존재하지만 source-only 등록 정책은 정확 ID 부재. 데이터/서류·법률 담당자에게 확장 전용 적용조건 정책, 단위·지갑·동일인/동일종목 복수행의 판단을 요청할 항목으로 남김. 미등록 자료도 보존.
2. **P2 법률 전문 검토 후보 누락(기존 Draft [#56](https://github.com/firmengine/firmengine/pull/56) 추적)**: 원본 `reviewScope("cash_deposit_asset")`의 검토 후보에는 `SEOUL-408`가 없지만 `reviewScope("crypto_balance")`에는 존재함. #237–240의 실제 라우팅 family가 전자라서 crypto 전용 **검토 후보**가 빠짐. 기존 PR #56 미병합이며 같은 파일의 [#51](https://github.com/firmengine/firmengine/pull/51) 등과 충돌·법률 근거 검증 전 임의 병합하지 않음.
3. **P2 메타데이터 의미 검토 후보 #228**: `creditor_assignment_dispute::assignment_date`는 `datatype=date`인데 `temporal_role=not_applicable`; 원본 `hasPeriod`는 **false**. 반면 #222 `event_date`, #234 `notice_date`는 true. 날짜 자체와 별도 기간/기준일 요건은 다르므로 자동 정책 변경 없이 발효일/양도통지일/자료발급일의 법적·시간적 의미를 담당자가 검토해야 함. 실제 OCR 누락이나 법률오판은 재현하지 않았음.
4. **현 채무원금 이중계상 위험**: #221 `currency_unit`과 #226 `reported_amount`는 동일 신용조회 행/기관/기준일 검산 대상; 조회금액은 현 채무원금이 아님. #228 채권양도일 ≠ #234 양도통지일, #231 조회상 현 청구권자 ≠ 최종 법률상 채권자, #233 다툼금액 ≠ 인정 원금. #229 claim_id·#230 status·#232 dispute_basis·#235 prior_creditor·#236 supporting_record를 같은 원채권/채무자에 묶고 현 채무잔액증명·양도통지 확인할 것. `INTAKE-055` 조회서는 현 부채증명을 대체하지 않음.
5. **가상자산 원단위/시가**: #239 native quantity와 #240 source quote currency/asset 단가는 다른 물리량. #241 displayed_valuation/기준일/거래소 지갑·소유자·출금제한·중복자산을 검토할 때까지 원화 환산·수량×취득단가를 현재 청산가치로 인정·합산 금지. 미관찰/null/0/비해당/상충/source-only/승인전은 서로 다르다.
6. 이번 원본 `hasPeriod` 결과 **2/20 true**(#222, #234), `hasUnit` 결과 **4/20 true**(#226, #233, #239, #240). 두 후보 술어는 **시간/단위 검토 메타데이터**이지 실제 OCR/검증률이 아님.

## 4. 5역할 중앙 보드 인수 ID (전부 [ ] 부분)
- `A3-AX-012`: 20 source-only의 법률·검산·역질문 가치/crypto 전용 후보 누락; 기존 #56과 법률 판본·담당자 승인 미검증.
- `A3-IT-007`: 필드별 정확 타입·원단위·#228 날짜 역할, #226/#233 통화·#239 native 수량·#240 quote 단가 혼용 방지. OCR 변환·원화 FX 실제 실행 미검증.
- `A3-DATA-019`: 가상자산 4개 정확 applicability 미등록(0% 합격), 20 원천 링크 자체는 보존; 담당자 승인정책 미등록.
- `A3-CALC-005`: 신용조회 표시금액과 다툼금액을 현 원금/이자로 무단 합산 금지. 18산식/91 입력 등록과 실제 계산 성공은 다름.
- `A3-LAW-003`: 채권양도·다툼·법원 통지의 날짜/주체 분리, 정확 법률증거 0/20; 실무자·법원 결정 미인증.

## 5. 누적 상태·다음 감사
- 과거 canonical 전체 **693/693 최초 순차 정적 조사** 완료, 이번 심층 재감사 누적 **240/693**; A3 제품 인수 완료 **0/124**. 이번 검증의 정적/함수 검사는 CI·DB·OCR·법률·공식서식·배포 합격이 아님.
- 다음 정확 시작 ID **#241 `crypto_balance::displayed_valuation`**, 범위 **#241~260**, 다음 순환 시작 **사용자·서류담당자**. crypto/securities 동일 지갑·기준일·통화/보유자·시가/가용량 및 분리 기록을 검증.
- 운영 배포/운영 마이그레이션/실제 전자제출/법원 인가 확정 및 고객문서·OCR 원본값·키·.env·비공개 답변 저장 **미실행**.

## 6. 조회한 Git blob 및 고정 인덱스
- `lib/canonical-field-id-index.json` = `27ecdddd208de82a2f5c675e7482485e3a8838c2`
- `lib/document-agent-field-contracts.json` = `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`
- `lib/shared-document-field-contracts.json` = `9decab974e0909ae24ad927bdfe241d75b71f3a9`
- `lib/ocr-field-supplements.json` = `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`
- `lib/field-applicability-contracts.json` = `6076b26f782c4643a21a7b2f1a8f6261bb588b68`
- `lib/feature-lineage-audit.ts` = `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`
- `lib/material-calculation-source-gate.ts` = `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`
- `lib/ocr-chain-matrix.ts` = `977de86ba698bd805cc6b95d1384e3b49d0dbb4c`
- `lib/reference-decision-tables.json` = `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`
- `lib/legal-evidence-criteria.ts` = `6c0b94535700d4fa4d356f8a91d5b9440b5ac52a`
