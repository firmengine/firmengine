# FirmEngine A3 r50 — canonical OCR #281–300 증거·계산·법률·양식 소비처 심층 재감사

- 감사일 2026-11-01 KST. GitHub `main` 사전 HEAD: `7a3c7c691087f58b5d9054a55286c5cfd3acd51a`. 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 직전 r49 #261–280 영수증 `20261101-r49-canonical-261-280-consumer-recheck-1325KST.md`와 최초 r15 동일 구간 기록 `20261031-r15-canonical-281-300.md`를 확인한 뒤 현재 기준정보로 **재계산**.
- 역할 순환 **AX→IT→사용자·서류→계산사무장→변호사**. 보드 **A3-AX-012, A3-IT-003, A3-DOC-003, A3-CALC-005, A3-LAW-007** 모두 미완료 `[ ]` 유지. 다음 시작 역할 데이터담당자.
- 본 영수증은 **GitHub 정적 원천 조인 및 V8 소스 술어/정적 독립 단언**. 프로젝트 native Node 테스트/CI, OCR 실제 인식, D1/R2/Cron 재독·배포, 공식 법원 DOCX/PDF, 변호사 승인과 **다름**. 운영 배포·D1 운영 마이그레이션·전자제출·법원 인가 확정 미실행. 고객/비공개 사건/키/`.env`/실 OCR값 미사용.

## 실제 실행한 독립 검증

- GitHub 원본 693개 canonical ID를 인덱스 순서대로 순회하고 85개 공개 서류 정의/48개 패밀리 기본필드/문서별 확장/7 문서 보강을 `shared-document-catalog.ts`의 실제 병합 순서와 동일하게 독립 JS 조인. 전체 **1,808원천 슬롯**, 중복 0·고아 0·패밀리 미등록 0. 85개 recordPolicy가 `sourceOnly`, `noCrossRecordBorrowing` 선언.
- #281–300 **20개/135 슬롯** = 채무증명 12피처 **111 슬롯**(11 ID×10 문서, #282 단일문서) + 이혼기록 8피처 **24 슬롯**(3 family×8). 문서별 원문 위치/페이지·행·해시 필수 앵커는 **선언**만 확인; 실제 값 존재/문서·페이지·복수 행·주체/기간·bbox·quote 저장 확인은 미실행.
- 원본 `feature-lineage-audit.ts`에서 `hasPeriod`, `hasUnit`, `reviewScope` 함수식을 추출해 TypeScript 선언만 제거한 뒤 V8에서 실행. 20 ID × 2 = **40개 기간·단위 술어 실행** + 실제 3 family·합성 문자열의 전문 검토 후보 비교. 실제 OCR 경고/차단 재현 아님.
- `canonical-field-binding.ts` 명시형 map·18계산/91선언 입력(78고유 경로)·`material-calculation-source-gate.ts`·`ocr-chain-matrix.ts`의 정확 ID를 조인. 실제 D5106 `template-token-catalog.json`의 토큰 존재까지 확인(4/4); **선언 토큰 존재≠실제 DOCX 채움≠공식 전자서식 인가**.
- 95 법률위험·50 법률규칙·46 예외 seed의 정확 canonical 필드 `required_features`/`features` 직접 매핑 **0/20**. 문서별 후보 법률 링크·판본/관할·실무자 승인과 별개.
- **독립 기대/관찰 검증 37/37 일치** (정적 구조, 원본 V8 술어 및 정확 선언 규칙에 국한). 적용조건 미등록/승인미확인은 합격이 아니라 **0% 합격**; 전체 제품 합격률로 오인 금지.

| # | 독립 검증 조건 | 기대 | 관찰 | 판정 |
|---:|---|---|---|---|
| 1 | 693 canonical | `693` | `693` | 정적/격리 기대 일치 |
| 2 | 693 unique | `693` | `693` | 정적/격리 기대 일치 |
| 3 | 85 documents | `85` | `85` | 정적/격리 기대 일치 |
| 4 | 48 families | `48` | `48` | 정적/격리 기대 일치 |
| 5 | 1808 declared routes | `1808` | `1808` | 정적/격리 기대 일치 |
| 6 | 0 duplicated routes | `0` | `0` | 정적/격리 기대 일치 |
| 7 | 0 orphan routes | `0` | `0` | 정적/격리 기대 일치 |
| 8 | 0 unregistered route family | `0` | `0` | 정적/격리 기대 일치 |
| 9 | 0 cross-family type/unit collision in range | `0` | `0` | 정적/격리 기대 일치 |
| 10 | 85 source-only and no cross-row borrowing declarations | `85` | `85` | 정적/격리 기대 일치 |
| 11 | 20 contiguous rows | `20` | `20` | 정적/격리 기대 일치 |
| 12 | 135 range slots | `135` | `135` | 정적/격리 기대 일치 |
| 13 | 111 debt slots | `111` | `111` | 정적/격리 기대 일치 |
| 14 | 24 divorce slots | `24` | `24` | 정적/격리 기대 일치 |
| 15 | 6 exact typed | `6` | `6` | 정적/격리 기대 일치 |
| 16 | 2 direct calculation inputs | `2` | `2` | 정적/격리 기대 일치 |
| 17 | 2 must reconcile | `2` | `2` | 정적/격리 기대 일치 |
| 18 | 4 direct form targets | `4` | `4` | 정적/격리 기대 일치 |
| 19 | all four actual template tokens | `4` | `4` | 정적/격리 기대 일치 |
| 20 | 0 exact legal canonical links | `0` | `0` | 정적/격리 기대 일치 |
| 21 | 18 calculators | `18` | `18` | 정적/격리 기대 일치 |
| 22 | 91 declared inputs | `91` | `91` | 정적/격리 기대 일치 |
| 23 | 95 risk | `95` | `95` | 정적/격리 기대 일치 |
| 24 | 50 rules | `50` | `50` | 정적/격리 기대 일치 |
| 25 | 46 exceptions | `46` | `46` | 정적/격리 기대 일치 |
| 26 | 11 exact applicability registrations | `11` | `11` | 정적/격리 기대 일치 |
| 27 | 9 exact applicability gaps | `9` | `9` | 정적/격리 기대 일치 |
| 28 | debt principal only derived input | `false` | `false` | 정적/격리 기대 일치 |
| 29 | debt interest direct | `true` | `true` | 정적/격리 기대 일치 |
| 30 | creditor address unregistered | `false` | `false` | 정적/격리 기대 일치 |
| 31 | all divorce extensions unregistered | `0` | `0` | 정적/격리 기대 일치 |
| 32 | 0 source families containing spouse | `0` | `0` | 정적/격리 기대 일치 |
| 33 | divorce 3 route scopes omit SEOUL-406 | `false` | `false` | 정적/격리 기대 일치 |
| 34 | existing reviewer conditional returns SEOUL-406 for synthetic spouse family | `true` | `true` | 정적/격리 기대 일치 |
| 35 | issue date period flag | `true` | `true` | 정적/격리 기대 일치 |
| 36 | origination date period flag absent | `false` | `false` | 정적/격리 기대 일치 |
| 37 | material principal+interest are different targets | `true` | `true` | 정적/격리 기대 일치 |

## 이번 20개 개별 소비처·공백 누적표

다음 P/U는 main의 원본 `hasPeriod/hasUnit` **결과**, 계산·typed/form/legal은 **선언 또는 정확 경로 후보**. 문서별 locator·source_sha256·page·record_ordinal·field_ordinal·quote/bbox, sourceState(미관찰/null/실제0/비해당/상충/source-only/승인전)를 서로 대체하거나 법적 확정으로 승격하지 않는다.

채무증명 10문서: debt_certificate, creditor_request_copy, loan_contract, card_statement, private_loan_transfer, mortgage_balance, loan_use_of_funds, vehicle_lease_contract, prior_creditor_list, private_adjustment_records. 이혼기록 3 routes: asset_transfer_disposition, identity_residence_record, household_composition_support. 85서류/48패밀리의 정확한 문서별 라우트만 인정.

| # | canonical ID | 문서 / OCR family (슬롯) | 타입 / 원단위 / 시간역할 / 대상 | 적용조건 | P/U | typed / 18·91 직접입력 / material / 서식토큰 / exact 법률 | 실제 소비처 공백·증거/검산/역질문 |
|---:|---|---|---|---|---|---|---|
| 281 | `debt_certificate::creditor` | 10 debt documents / debt_certificate (10) | party_role / not_applicable / not_applicable / debtor | 정확등록 | N/N | debt.creditor / debt.creditor / — / D5106.creditor.entity / exact 법률 0 | 채권자 원문·계약 식별/양도 검증 |
| 282 | `debt_certificate::creditor_address` | debt_certificate / debt_certificate (1) | address / not_applicable / not_applicable / document_subject | **미등록(0%)** | N/N | debt.address / 0 / — / D5106.creditor.address / exact 법률 0 | 채권자 송달지 주소: 발행기관과 구별 |
| 283 | `debt_certificate::debtor` | 10 debt documents / debt_certificate (10) | party_role / not_applicable / not_applicable / debtor | 정확등록 | N/N | — / 0 / — / — / exact 법률 0 | 실제 채무주체·공동채무자 구별 |
| 284 | `debt_certificate::fees` | 10 debt documents / debt_certificate (10) | money / currency and exact source unit if monetary / not_applicable / debtor | 정확등록 | N/Y | debt.costs / 0 / — / — / exact 법률 0 | 집행/징수비용과 본원금·총액 중복 차단 |
| 285 | `debt_certificate::interest_balance` | 10 debt documents / debt_certificate (10) | money / currency and exact source unit if monetary / not_applicable / debtor | 정확등록 | N/Y | debt.interest / debt.interest / must_reconcile→debt.interest / D5106.creditor.interest / exact 법률 0 | 이자잔액·기준일 검산, 필수대조 |
| 286 | `debt_certificate::issue_date` | 10 debt documents / debt_certificate (10) | date / source date format normalized to ISO without loss / document_issue_date / debtor | 정확등록 | Y/N | — / 0 / — / — / exact 법률 0 | 발급일과 잔액기준일 구별 |
| 287 | `debt_certificate::issuer` | 10 debt documents / debt_certificate (10) | party_role / not_applicable / not_applicable / debtor | 정확등록 | N/N | — / 0 / — / — / exact 법률 0 | 증명서 발행자≠실제 채권자 |
| 288 | `debt_certificate::original_principal` | 10 debt documents / debt_certificate (10) | money / currency and exact source unit if monetary / not_applicable / debtor | 정확등록 | N/Y | — / 0 / — / — / exact 법률 0 | 원래 원금≠현재 잔액 |
| 289 | `debt_certificate::origination_date` | 10 debt documents / debt_certificate (10) | date / source date format normalized to ISO without loss / not_applicable / debtor | 정확등록 | N/N | — / 0 / — / — / exact 법률 0 | 최초 발생일; 기간검사 비적용의 법률의미 검토 |
| 290 | `debt_certificate::overdue_interest` | 10 debt documents / debt_certificate (10) | money / currency and exact source unit if monetary / not_applicable / debtor | 정확등록 | N/Y | — / 0 / — / — / exact 법률 0 | 연체이자↔전체 이자 포함관계 확인 |
| 291 | `debt_certificate::principal_balance` | 10 debt documents / debt_certificate (10) | money / currency and exact source unit if monetary / not_applicable / debtor | 정확등록 | N/Y | debt.principal_balance / 0 / must_reconcile→debt.principal / D5106.creditor.principal / exact 법률 0 | 현재 원금, derived_from_ocr_review_required 경계 |
| 292 | `debt_certificate::total_claim` | 10 debt documents / debt_certificate (10) | money / currency and exact source unit if monetary / not_applicable / debtor | 정확등록 | N/Y | debt.total / 0 / — / — / exact 법률 0 | 총청구액은 component checksum, 중복합산 금지 |
| 293 | `divorce_records::actual_support_paid` | divorce_records / 3 families (3) | money / source currency/unit / not_applicable / document_subject | **미등록(0%)** | N/Y | — / 0 / — / — / exact 법률 0 | 양육비 실제 지급≠명목 약정 |
| 294 | `divorce_records::agreement_or_order_date` | divorce_records / 3 families (3) | date / not_applicable / source_date_time_or_period / document_subject | **미등록(0%)** | Y/N | — / 0 / — / — / exact 법률 0 | 합의/결정 기준일·효력 검토 |
| 295 | `divorce_records::divorce_date` | divorce_records / 3 families (3) | date / not_applicable / source_date_time_or_period / document_subject | **미등록(0%)** | Y/N | — / 0 / — / — / exact 법률 0 | 이혼일/가구 지위 기준일 검증 |
| 296 | `divorce_records::former_spouse` | divorce_records / 3 families (3) | party_role / not_applicable / not_applicable / document_subject | **미등록(0%)** | N/N | — / 0 / — / — / exact 법률 0 | 전 배우자 식별, 전문 검토 후보 누락 |
| 297 | `divorce_records::marriage_date` | divorce_records / 3 families (3) | date / not_applicable / source_date_time_or_period / document_subject | **미등록(0%)** | Y/N | — / 0 / — / — / exact 법률 0 | 혼인일: 소유/지분 판단 별도 |
| 298 | `divorce_records::partition_amount` | divorce_records / 3 families (3) | money / source currency/unit / not_applicable / document_subject | **미등록(0%)** | N/Y | — / 0 / — / — / exact 법률 0 | 재산분할액은 실제 소유재산 가액 아님 |
| 299 | `divorce_records::partition_asset` | divorce_records / 3 families (3) | identifier / not_applicable / not_applicable / document_subject | **미등록(0%)** | N/N | — / 0 / — / — / exact 법률 0 | 분할 대상 자산·명의/중복 확인 |
| 300 | `divorce_records::support_child` | divorce_records / 3 families (3) | party_role / not_applicable / not_applicable / document_subject | **미등록(0%)** | N/N | — / 0 / — / — / exact 법률 0 | 양육비 자녀/부양대상 관계 검증 |

## 확인된 공백 및 판단 경계

1. **P2 적용조건 미등록 9/20, 각 0% 합격:** #282 debt_certificate::creditor_address; #293 divorce_records::actual_support_paid; #294 divorce_records::agreement_or_order_date; #295 divorce_records::divorce_date; #296 divorce_records::former_spouse; #297 divorce_records::marriage_date; #298 divorce_records::partition_amount; #299 divorce_records::partition_asset; #300 divorce_records::support_child. 기본 패밀리 OCR 및 특정 서류 확장 피처는 원천에 존재하지만, `field-applicability-contracts.json` exact ID가 없음. 실제 `document-agent-registry.ts`의 `compactFamilyFieldContract()`는 sourceCondition을 `null`로 만든다. 미등록은 자동 삭제·비해당·법률상 불필요 판단 아님. 서류담당자/법률담당자가 적격 적용조건 및 version/관할/승인을 검토해야 하며 자동 등록 금지.
2. **P2 이혼/전배우자 검토후보 누락 가능:** 실제 `reviewScope(route.familyId)`를 3 routes에 실행했을 때 `SEOUL-406` 미포함. 코드의 `family.includes("spouse")` 조건을 실행시킬 **48 패밀리명 중 spouse 포함 0개**(합성 `former_spouse`일 때만 후보 발생). 따라서 #296 전배우자 정보 등은 특화 후보를 찾지 못한다. 이것은 **후보 표시 공백**이며 SEOUL-406의 법원 법령/판본/관할 적용 정당성·필수요건은 확인되지 않았고 법률승인 **0%**. [A3 기존 Draft PR #51](https://github.com/firmengine/firmengine/pull/51) 등 동일 파일의 미병합 변경과 충돌 우려가 있으므로 정책/코드 변경하지 않음.
3. **#282 직접 서식 선언·미등록 적용조건 병존:** `debt_certificate::creditor_address`는 typed `debt.address` 및 `D5106.creditor.address` 토큰이 존재하지만 sourceCondition=null. 공식 기재/송달 유효성 검증 전 최종 서식 필수항목으로 승인 금지.
4. **#285/#291 material 구분:** `interest_balance`는 typed `debt.interest`와 91입력 정확 일치, `principal_balance`는 typed `debt.principal_balance`이지만 계산 입력 `debt.principal`과 **정확 불일치**; `calculation-input-audit.ts`의 `derived_from_ocr_review_required` 및 `fact-object-projection.ts`의 명시 alias 경유임을 별도 표기. 둘 모두 `must_reconcile` 계약, **자동 채권확정/법률인정 아님**. 최초원금 #288, 이자 #285, 연체이자 #290, 수수료 #284, 총청구액 #292는 같은 사건·채권·기준일/포함범위 검증 전 단순 합산 금지. 원단위 없는 원화 환산 금지.
5. **법률·갈음·보정 경계:** #293 실제 양육비, #298 재산분할 약정금은 각각 지급증거/가구·재산 검토 대상이지 자동 월 추가생계비/재산가치 확정액이 아님. `document-substitution.ts`의 승인·관할 경로와 `case-requirements.ts`의 담당자 보정/대체제출은 별도이며, 이번 20 ID의 실제 고객 사건에 대한 대체서류·보정명령 E2E 소비는 **미관찰**. 0 직접 계산/법률 소비처라 해도 역질문, 동일인/자산/기간 대조 및 증거보존 검토.
6. **기존 P1 Draft 상태 유지:** `material-calculation-source-gate.ts`의 원천 Fact 상태 검증 공백은 최초 r15 영수증에서 재현했고 [Draft PR #63](https://github.com/firmengine/firmengine/pull/63)이 수정안을 보유. [Draft PR #44](https://github.com/firmengine/firmengine/pull/44)가 같은 파일 변경. **이번에 원본 금액 함수 자체 재실행/Node 검증은 하지 않았으므로 이전 영수증의 실증으로만 연결**하고 두 Draft 미병합/통합 검토 필요. 아직 실제 운영 계산 실패 확정 아님.
7. **시간역할 주의:** #289 `origination_date`는 datatype=`date`지만 temporal_role=`not_applicable`이므로 원본 `hasPeriod()`=false(관찰). 날짜 형식검사와 기간식별검사는 다른 요건; 문제 확정이 아니라 검토 후보로만 보존.

## 중앙 보드 5 ID 부분 검증 / 불완료 이유

- **A3-AX-012 [ ]:** 원본 `reviewScope`로 3/3 이혼 원천패밀리에서 배우자특화 `SEOUL-406` 후보 누락 가능성을 관찰. 승인 법률판본/관할·통합 테스트 미확인.
- **A3-IT-003 [ ]:** 18모듈/91입력, #281–300의 typed6/정확 calc2/material2/서식 선언4 정적 연결. 실제 계산 실행·CI·D1 재독 미확인.
- **A3-DOC-003 [ ]:** 8 이혼 피처 3패밀리 24슬롯, 원천 페이지·복수행·대상·시점·추가서류 역질문 경로 선언; 갈음/법원 보정 실제 사건 처리 미확인.
- **A3-CALC-005 [ ]:** 총원금·원리금·연체·비용 구별, `debt.principal_balance`→`debt.principal` derived 미승인. 원천검증 상태·금액 계산 실증 미인증.
- **A3-LAW-007 [ ]:** 재산분할·배우자/자녀·청산가치 판단은 법률위험95/규칙50/예외46 seed exact 결합 0, 판본/관할·변호사 인정 0%.

## 최신 소스 blob SHA와 검증 수준

- `lib/canonical-field-id-index.json`: `27ecdddd208de82a2f5c675e7482485e3a8838c2`
- `lib/document-agent-field-contracts.json`: `9884b3fecf44643fefcdc4a421ed66ffc5477b3a`
- `lib/shared-document-field-contracts.json`: `9decab974e0909ae24ad927bdfe241d75b71f3a9`
- `lib/ocr-field-supplements.json`: `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5`
- `lib/field-applicability-contracts.json`: `6076b26f782c4643a21a7b2f1a8f6261bb588b68`
- `lib/reference-decision-tables.json`: `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`
- `lib/risk-catalog.json`: `e96dd0926e3ae9be5a5573d4551538ba294c4d2e`
- `lib/legal-catalog.json`: `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e`
- `lib/legal-exceptions.json`: `6e51197226bfd8320e1147d8df3f12c11e00927c`
- `lib/template-token-catalog.json`: `899c4d564fcb1726861f89dcf04dbf1b7e372687`
- `lib/feature-lineage-audit.ts`: `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`
- `lib/ocr-chain-matrix.ts`: `977de86ba698bd805cc6b95d1384e3b49d0dbb4c`
- `lib/material-calculation-source-gate.ts`: `0286b44484913b63fa8ec3f7bf0ca59b034d0dab`
- `lib/canonical-field-binding.ts`: `60ee5c7762d52b72a165b4f4f8214680eb98f148`
- `lib/document-agent-registry.ts`: `f2299ff2588be6570ce6493098547b10f66d9fed`
- `lib/calculation-input-audit.ts`: `288edc397527842c96874ef3e713f23bb534a5f1`
- 추가 실조회: `db/schema.ts`(`933f8686845ac14669312dd21bf85e02c62ed5e6`), `lib/shared-document-catalog.ts`(`4cd07ebcc11d2d9d803a117ae98424292e1c5cba`), `lib/form-contracts.ts`(`7da88eb8b1c6af8eb440fd0589f9ff8edb6b39ef`), `tests/ocr-calculation-db-contract.test.ts`(`34a1d2349da9f2f28fd4d3266c3782410b2a2783`)의 기존 채무원리금 분리 테스트 **코드 존재 확인**(Node 실행 아님); [PR #63](https://github.com/firmengine/firmengine/pull/63)/[#44](https://github.com/firmengine/firmengine/pull/44)/[#51](https://github.com/firmengine/firmengine/pull/51) 현재 open Draft 조회.

**다음 시작 #301 `divorce_records::support_payer` (#301–320), 다음 회차 시작 역할 데이터담당자.** 누적 소비처 재감사 **300/693**, 최초 정적 순차 ID 인덱스 **693/693**, A3 통합 인수 체크 ID 124개 중 완료 0(최신 보드 사후 재조회 필요).
