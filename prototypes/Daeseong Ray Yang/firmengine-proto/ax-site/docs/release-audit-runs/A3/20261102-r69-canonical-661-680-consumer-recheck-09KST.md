# FirmEngine A3 r69 — canonical OCR #661–680 증거·계산·법률·서식 소비처 심층 재감사

- 감사 수행: **2026-11-02 KST**. 시작시 확인한 `main` HEAD `e1b6f8dd59a4eaa6e2cc9ac34fb5ac7de6b56048`. 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` **내부만**. 직전 r68 #641–660/누적 660을 이어 받아 r69 #661–680. 이전 초기 #661–680 정적 조사(r34)와 r64 부동산 자산 결합 반례·[Draft PR #155](https://github.com/firmengine/firmengine/pull/155)를 읽고 추가 런타임 격리 검사를 수행.
- 이번 담당 순환 **AX → IT → 사용자·서류 → 계산사무장 → 변호사**. 선택 체크 ID: `A3-AX-019`, `A3-IT-003`, `A3-DOC-006`, `A3-CALC-007`, `A3-LAW-014`. 5개 전부 **[ ] 부분감사·미완료**, A3 총 124 체크 ID **합격 0개**. 다음 시작 담당은 **데이터**.
- 85 문서/48 family에서 `base.fields + shared extension + supplement`를 원본 `shared-document-catalog.ts`의 합성 규칙으로 수집: canonical **693 고유**, 전체 **1,808** 선언 슬롯, 고아/인덱스 미등록 0. #661–680 정확 **20개 ID/42 슬롯/4문서/2 family**; 42/42 증거 locator(문서 hash·page·row·quote/bbox) 및 행차용 금지 `noCrossRecordBorrowing` **선언 존재**. 실제 문서 원문/PDF 페이지·D1 Fact·동일 차량중복·실제 R2 재조회 **미관찰**.
- 적용조건 정확 ID **18/20**. #661 `vehicle_registration::record_issue_date`, #662 `vehicle_registration::vin`은 **미등록 2건 (승인 검증 0%)**, 둘 다 원문 source-only 보존. 42 슬롯의 적용조건 등록 수 **40**. 원본 `hasPeriod` 참 14/42, `hasUnit` 참 11/42, 단위 검사 true인데 단위 메타 `not_applicable` **2슬롯 (#676·#677)**.
- `canonical-field-binding.ts`의 **실제 원본 `bindCanonicalSourceField`·`canonicalProjectionKey` 함수본문**을 TS 타입만 격리 제거해 평가: **42/42 exact ID binding 일치**, 직접 typed **0/20**. `material-calculation-source-gate.ts` 선언 29개 중 #675 **1개** `must_reconcile→asset.grossValue`, 그러나 자동 typed 변환 없음. 나머지 19개는 정확 material 대조 소비 0으로 source-only·증거·검산·법적 역질문 보존.
- `reference-decision-tables.json`의 계산 **18개/91 input 선언 (78 고유)**; 차량은 `asset_liquidation`의 `asset.grossValue`, `asset.ownershipBps`, `asset.securedPayoff`, `asset.asOf` 등을 **사람이 검토한 typed 자산을 통해서만** 공급 가능한 후보. 금액만 같은 OCR가 18개 계산 전체에 자동 적재된다는 증명 아님.
- `ocr-chain-matrix.ts::OCR_DECLARED_FORM_TARGETS`의 이번 20 ID exact **0개**. 차량 `reviewScope`의 D5101/D5110은 *양식 검토 후보*이지 공식 token·실제 작성/제출 성공이 아님. 법률위험 **95**, 규칙 **50**, 예외 **46**의 seed 정적 exact canonical 계약 0/20; `LEGAL_EVIDENCE_POLICY_SEED.checks=[]`. **관리형 동적 정책·관할/시행일·변호사 승인은 미조회/미인증(0% 합격).**
- DB 계약: `db/schema.ts`의 `extraction_records`→`extracted_features`(`raw_value_json`, `canonical_field_id`, `source_state`)→`extraction_field_coverage`와 `feature-lineage-audit.ts`의 `document_id/page/record_ordinal/field_ordinal/source_sha256` lineage. 존재하는 스키마와 **실제 저장·재독/개인정보 분리검증은 별개**.

## 이번 20개 ID별 소비처·공백

서류 R=`vehicle_registration`, S=`security_register`, L=`vehicle_lease_contract`, V=`vehicle_valuation`. P/U/A=해당 슬롯의 **원본 기간 술어 true / 단위 술어 true / 정확 적용조건 등록**의 건수, OCR 실제 인식률 아님. 모든 행은 정확 ID 원문·페이지·복수행·단위·기간·대상을 구분하는 계약 선언만 관찰; 실제 고객 자료 없음.

| # | 정확 canonical ID | source 서류(슬롯) | datatype; 단위; 기간; 주체 | P/U/A | DB Fact→typed 및 material 계산 | form token / approved legal |
|---:|---|---|---|---|---|---|
| 661 | `vehicle_registration::record_issue_date` | R (1) | date; YYYY-MM-DD; source_date_time_or_period; document_subject | 1/0/0 | source-only; 증거·검산·역질문; typed 0 | exact token 0 / static legal 0 |
| 662 | `vehicle_registration::vin` | R (1) | identifier; not_applicable; not_applicable; document_subject | 0/0/0 | source-only; 증거·검산·역질문; typed 0 | exact token 0 / static legal 0 |
| 663 | `vehicle_registry::acquisition_date` | S,R,L (3) | date; source date format normalized to ISO without loss; effective_date; owner_registered | 3/0/3 | source-only; 증거·검산·역질문; typed 0 | exact token 0 / static legal 0 |
| 664 | `vehicle_registry::co_owners` | S,R,L (3) | party_role; not_applicable; not_applicable; owner_registered | 0/0/3 | source-only; 증거·검산·역질문; typed 0 | exact token 0 / static legal 0 |
| 665 | `vehicle_registry::lien_date` | S,R,L (3) | date; source date format normalized to ISO without loss; registration_effective_date; owner_registered | 3/0/3 | source-only; 증거·검산·역질문; typed 0 | exact token 0 / static legal 0 |
| 666 | `vehicle_registry::lien_holder` | S,R,L (3) | party_role; not_applicable; not_applicable; owner_registered | 0/0/3 | source-only; 증거·검산·역질문; typed 0 | exact token 0 / static legal 0 |
| 667 | `vehicle_registry::ownership_share` | S,R,L (3) | ratio; ratio/fraction as stated; not_applicable; owner_registered | 0/3/3 | source-only; 증거·검산·역질문; typed 0 | exact token 0 / static legal 0 |
| 668 | `vehicle_registry::registered_lien_amount` | S,R,L (3) | money; currency and exact source unit if monetary; not_applicable; owner_registered | 0/3/3 | source-only; 증거·검산·역질문; typed 0 | exact token 0 / static legal 0 |
| 669 | `vehicle_registry::registered_owner` | S,R,L (3) | party_role; not_applicable; not_applicable; owner_registered | 0/0/3 | source-only; 증거·검산·역질문; typed 0 | exact token 0 / static legal 0 |
| 670 | `vehicle_registry::registration_status` | S,R,L (3) | category; not_applicable; not_applicable; owner_registered | 0/0/3 | source-only; 증거·검산·역질문; typed 0 | exact token 0 / static legal 0 |
| 671 | `vehicle_registry::release_date` | S,R,L (3) | date; source date format normalized to ISO without loss; discharge_effective_date; owner_registered | 3/0/3 | source-only; 증거·검산·역질문; typed 0 | exact token 0 / static legal 0 |
| 672 | `vehicle_registry::transfer_date` | S,R,L (3) | date; source date format normalized to ISO without loss; effective_date; owner_registered | 3/0/3 | source-only; 증거·검산·역질문; typed 0 | exact token 0 / static legal 0 |
| 673 | `vehicle_registry::vehicle_id` | S,R,L (3) | identifier; not_applicable; not_applicable; owner_registered | 0/0/3 | source-only; 증거·검산·역질문; typed 0 | exact token 0 / static legal 0 |
| 674 | `vehicle_valuation::actual_payoff` | V (1) | money; currency and exact source unit if monetary; not_applicable; owner_legal | 0/1/1 | source-only; 증거·검산·역질문; typed 0 | exact token 0 / static legal 0 |
| 675 | `vehicle_valuation::market_value` | V (1) | money; currency and exact source unit if monetary; not_applicable; owner_legal | 0/1/1 | must_reconcile→asset.grossValue; typed 0 | exact token 0 / static legal 0 |
| 676 | `vehicle_valuation::mileage` | V (1) | quantity; not_applicable; not_applicable; owner_legal | 0/1/1 | source-only; 증거·검산·역질문; typed 0 | exact token 0 / static legal 0 |
| 677 | `vehicle_valuation::model_year` | V (1) | integer; not_applicable; not_applicable; owner_legal | 0/1/1 | source-only; 증거·검산·역질문; typed 0 | exact token 0 / static legal 0 |
| 678 | `vehicle_valuation::owner` | V (1) | party_role; not_applicable; not_applicable; owner_legal | 0/0/1 | source-only; 증거·검산·역질문; typed 0 | exact token 0 / static legal 0 |
| 679 | `vehicle_valuation::registered_lien_amount` | V (1) | money; currency and exact source unit if monetary; not_applicable; owner_legal | 0/1/1 | source-only; 증거·검산·역질문; typed 0 | exact token 0 / static legal 0 |
| 680 | `vehicle_valuation::valuation_date` | V (1) | date; source date format normalized to ISO without loss; valuation_as_of_date; owner_legal | 1/0/1 | source-only; 증거·검산·역질문; typed 0 | exact token 0 / static legal 0 |

## 실제 격리 원본 함수 시험: 입력·독립 기대·관찰

### material gate — `auditMaterialCalculatorSources` 원본문 V8 **13개 시나리오**

`lib/material-calculation-source-gate.ts`의 원본 함수본문에서 TS 타입 주석만 제거. 실제 정의 **29개** 사용. `createCaseReadIndex/currentFacts/moneyValue/validSourceRef`는 명시적 합성 stub. 모든 입력은 가상 Fact ID, 가상 vehicle ID/owner/date, 원화표현이 아닌 숫자 100/99/0을 사용하며 실제 OCR/DB 연결을 흉내 낸 것이 아님. 아래의 **실행 13/13은 현재 단일 함수 분기 관찰 재현**이지 업무상 정합성 합격률이 아니다.

| 사례 | 합성 입력 → 독립 동작 기대 | 실제 코드 관찰 |
|---|---|---|
| 1 정상 | #675 Fact 100, linked typed asset.grossValue 100 → 문제 없음 | issue 0 |
| 2 미연결 | Fact 100, asset 없음 → `CALC_INPUT_UNCONNECTED_MATERIAL` | 해당 오류 |
| 3 중복 | Fact 100을 두 자산에 연결 → `CALC_INPUT_MULTIPLE_TYPED_MATCHES` | 해당 오류 |
| 4 금액상충 | Fact100 vs typed99 → `CALC_INPUT_AMOUNT_MISMATCH` | 해당 오류 |
| 5 금액 null | Fact.numeric=null → `CALC_INPUT_AMOUNT_INVALID` | 해당 오류 |
| 6 소스참조 불량 | ref.valid=false → `CALC_INPUT_SOURCE_INVALID` | 해당 오류 |
| 7 차량 다름 — **P1 조사 후보(기존 #155 범주)** | Fact VIN-A vs typed VIN-B, factId/금액 동일 → 업무상 **검토 보류 필요** | **issue 0** |
| 8 소유자 다름 — **P1 조사 후보** | Fact owner-A vs typed owner-B, factId/금액 동일 → 업무상 **검토 보류 필요** | **issue 0** |
| 9 평가일 다름 — P2 | Fact 2025-01-01 vs typed 2026-10-01, 금액 동일 → 업무상 기간 대조 필요 | **issue 0** |
| 10 담보 등기액 분리 | #679 100 → 총자산액 자동 입력하지 않음 | `observedIds=[]`, issue 0 |
| 11 실제 상환액 분리 | #674 100 → 총자산액 자동 입력하지 않음 | `observedIds=[]`, issue 0 |
| 12 명시적 없음 | #675 sourceState=explicit_none → 0원으로 자동 인식하지 않음 | source skip, issue 0 |
| 13 실제 0 | #675 sourceState=present, Fact0, typed0 → 금액 불일치 없음 | issue 0 |

**해석:** 1–6과 10–13의 원본 함수 경계 동작은 독립 기대와 일치했다. **7–9는 독립 업무 안전기대와 불일치**한다. 기존 r64에서 부동산 #576으로 진단한 *source Fact 대상↔자산 결합 검증*과 동일 코드의 차량 변형이므로 중복 새 확정 결함으로 합산하지 않는다. 이미 미병합 [Draft PR #155](https://github.com/firmengine/firmengine/pull/155)가 존재. 법률/회계적 차량 식별자·상대방·가치평가일 연결을 정하지 않고 main 단독 규칙 수정 금지. 실제 상위 `assessment.ts/calculateCase`, `asset-resolution.ts`, case 저장소·D1, 공식 양식 및 변호사 승인까지 실행하지 않았기에 실제 청산가치 오류를 확정하지 않는다.

### OCR 계산원천 셀 형식 게이트 — `calculationSourceCellIssues` 원본문 V8 **7개 가상 입력**

`lib/ocr-calculation-input.ts`의 `validDate`, `validTime`, `calculationSourceCellIssues` 본문을 TypeScript annotation만 제거해 실행; `normalizeMoney`만 단위별 `exact/unknown` 합성 stub. 상태 `present`, quote 유효. 실 OCR 이미지·계약 승인 결과 아님.

| 테스트 | 입력(datatype,value,unit) | 코드 관찰 | 업무상 의미 |
|---|---|---|---|
| 주행거리 단위 부재 | quantity, 15000, null | **issues=[]** | **P2**: #676 의미 정의 `unit explicit`·단위 확인 요구를 이 좁은 게이트가 검증하지 않음 |
| 주행거리 km | quantity, 15000, km | [] | 실제 주행거리 인식/단위 정상 증거 아님 |
| 원화 단위 부재 | money,100,null | `SOURCE_MONETARY_UNIT_MISSING` | 금전 단위만 차단 |
| 연식 단위 부재 | integer,2024,null | [] | 정수인 연식은 반드시 통화 단위가 필요한 것은 아님 |
| 불가능 날짜 | date,2026-02-30,null | `SOURCE_DATE_INVALID` | 날짜 형식 검사 동작 |
| 외화 단위 | money,100,USD | `SOURCE_MONEY_NOT_EXACT_KRW` | stub 기준 exact 원화 불허; 환율 변환·승인 아님 |
| 차대번호 | identifier,VIN-012,null | [] | 사람 확인한 차량 ID 연결 아님 |

`hasUnit(quantity/integer)=true`와 #676/#677의 `canonical_unit=not_applicable`은 이전 r34에 이미 지적된 계약 차이이며, 이번에 **원본 입력 게이트의 unit 누락 반응까지 재현**했다. 다만 #676은 계산 필수 input이 아니므로 *최종 계산이 오인식됐다*고 단정하지 않는다. 원문 주행거리와 km/mi 단위, 연식·제조연도 구별은 직원 검증 필요.

### 원본 binding/정적 행 일치

- 각 42 슬롯 원본 `bindCanonicalSourceField({key:local_id,canonicalFieldId:global_field_id},familyContract)` **42/42 exact 결속**. `canonicalProjectionKey` 9개 CaseData category별 확인: 이번 **직접 typed 0**. 사용자 입력에서 key/ID의 실제 위조·오분류가 차단됐다는 E2E가 아니라 함수 격리 결과.
- 최신 실제 인덱스 ID 유일 **693/693**, 문서 정의 **85**, 패밀리 **48**, 전체 slot **1808**, 이번 slot **42**, 정적 locator/행 독립 **42/42**, 정확 적용조건 **18/20**, 18 계산/91입력, 95/50/46 모두 독립 기대 수량과 일치.
- 기존 `tests/feature-lineage-audit.test.ts` (blob `4257434140eaa18efef88bc4fd1fc721048a4d00`) 및 `tests/material-calculation-source-gate.test.ts` (blob `eb37d53f09ad13fa0d13839325db8fd635c76bb7`)의 테스트 내용·assertion을 읽었다. **이 회차 정식 Node 테스트는 실행하지 않음**.

## P1/P2 및 증거보존·역질문

1. **P1 조사 후보/중복 위험:** #675 평가 금액 Fact와 typed 차량의 **동일 차대번호·소유/지분·차량 식별자·평가기준일** 연결을 좁은 material gate가 직접 점검하지 않음(위 7–9 재현). 기존 #576 부동산 대상 결합 문제 및 [Draft #155](https://github.com/firmengine/firmengine/pull/155)와 공통; 코드/법률 의미 변경은 별도 PR·담당 실무자 검토 후 처리. 다른 에이전트 변경 덮어쓰기 금지.
2. **P2 적용조건 누락 2:** #661 발급일, #662 VIN. 이전 r34 지적과 동일하며 이번에도 정확 등록 0/2. 미등록 요건 **승인 0%**, `source-only`로 유지·해당 차량 등록원부 원문/발급기관/발급시점/대상 차량/증빙기간을 역질문.
3. **P2 단위 확인:** #676 주행거리 quantity의 단위 null을 셀 검사 함수가 통과. `mileage`의 `canonical_unit`도 `not_applicable`인데 `semantic_definition=unit explicit`. km/mi 등을 직원이 확인하기 전 규격화·가격조정 금지.
4. **P2 채권최고액 혼용 금지:** #668/#679 등기상 최고담보액은 #674 **실제 상환액**이나 #675 **시가**와 다른 경제적 의미. #667 지분비율도 금액이 아니다. 11개 registry ID×3서류=33 선언 슬롯이 차량 33대를 의미하지 않음. #671 말소일·#672 양도일·#670 등록상태는 기준일·법적 효력을 별도 검토. 무단 지분비율/담보차감 원화합산 금지.
5. **법률·서식·갈음·보정:** `document-substitution.ts`와 `preapproval-correction-audit.ts`는 source-linked 인수 후보 경로를 제공하나, 4문서의 실제 **서류 요구→원문→기록된 갈음 승인→법원 보정명령 원문/기한→정식 서식 token→제출/인가**를 실행하지 않았다. 0개 direct consumer를 무용 또는 폐기 근거로 사용하지 않는다. source-only는 원본 대조/검산/역질문/법적 근거 리뷰에 남긴다.
6. **상태 구분:** **미관찰**, 명시 `null`, 실제 **0**, **비해당(승인 필요)**, **상충**, **source-only**, **승인 전**을 서로 대체하지 않는다. 문서·Fact·원문 값 저장/원화 승격/법률 판단 모두 사람 승인 없이는 확정 불가.

## 5개 A3 보드 체크 ID — 부분 검증만

| 역할/ID | 이번 정확 실행·관찰 | 미완료 범위 |
|---|---|---|
| AX `A3-AX-019` | 차량 평가액/등기 최고액/실상환액/지분/주행거리 구분, 42개 exact binding·20 ID 용도 정적 확인 | 원문 OCR·대상/금액 semantics, 모델의 실제 유사금액 혼용 E2E |
| IT `A3-IT-003` | 18 계산/91 입력 조회, #675 must 대조/직접 typed 0, material 원본 V8 13사례 재현 | 실제 18개 계산 실행 및 D1 재투영 |
| 서류 `A3-DOC-006` | 차량/담보/평가 관련 4문서·42슬롯, #661/662 적용조건 공백, VIN·소유자 역질문 도출 | 사건별 필수·갈음/법원 보정·원본 PDF |
| 계산 `A3-CALC-007` | #675 소유/물건/기준일 불일치 경계, asset_liquidation 9 입력 선언 확인 | 실제 청산가치·담보 차감·순가치 산식/법적 인정 |
| 변호사 `A3-LAW-014` | 95/50/46 정적 목록 및 exact 승인계약 0, 등기 담보액과 실상환액 분리 | 관할·시행일·공식 출처·변호사·법원 승인 |

**최종 인수 0/124**. 합성 함수 실행 ≠ 프로젝트 Node 전체 CI ≠ staging D1/R2/Cron ≠ 공식 Word/e-form 대조 ≠ 변호사 승인 ≠ 사이트 운영배포. 운영 D1 마이그레이션, 운영 배포, 실제 전자제출, 법원 인가 확정 **실행하지 않음**.

## 원본 GitHub source blob (이번 확인 main)

| 파일 | blob SHA |
|---|---|
| `lib/canonical-field-id-index.json` | `27ecdddd208de82a2f5c675e7482485e3a8838c2` |
| `lib/document-agent-field-contracts.json` | `9884b3fecf44643fefcdc4a421ed66ffc5477b3a` |
| `lib/shared-document-field-contracts.json` | `9decab974e0909ae24ad927bdfe241d75b71f3a9` |
| `lib/ocr-field-supplements.json` | `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5` |
| `lib/field-applicability-contracts.json` | `6076b26f782c4643a21a7b2f1a8f6261bb588b68` |
| `lib/canonical-field-binding.ts` | `60ee5c7762d52b72a165b4f4f8214680eb98f148` |
| `lib/material-calculation-source-gate.ts` | `0286b44484913b63fa8ec3f7bf0ca59b034d0dab` |
| `lib/ocr-calculation-input.ts` | `8f7f51bf41f7c944b76419d7cc894e49ac771473` |
| `lib/feature-lineage-audit.ts` | `de81bc3b8c460b8a4dde3fda9e13087e619e74ff` |
| `lib/ocr-chain-matrix.ts` | `977de86ba698bd805cc6b95d1384e3b49d0dbb4c` |
| `lib/legal-catalog.json` | `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e` |
| `lib/risk-catalog.json` | `e96dd0926e3ae9be5a5573d4551538ba294c4d2e` |
| `lib/legal-exceptions.json` | `6e51197226bfd8320e1147d8df3f12c11e00927c` |
| `lib/reference-decision-tables.json` | `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` |
| `lib/legal-evidence-criteria.ts` | `6c0b94535700d4fa4d356f8a91d5b9440b5ac52a` |

## 다음 시작점

- 현재 심층 재감사 **#680/693 (98.1%)**; 잔여 **13**. 다음 **#681 `vehicle_valuation::valuation_method` → #693 `wage_withholding_tax::income.tax.year_end_adjustment`**. 다음 역할 시작 **데이터담당자**.
- 다음 회차에도 이번 5개 ID 완료로 승격하지 않고, 본 회차에서 발견한 차량 #675 대상 결속·#676 주행거리 단위 문제를 기존 부동산 PR #155와 충돌 없이 추적한다. 실제 OCR/D1/E2E와 담당 변호사 인수 전 0% 승인.

<details>
<summary>최신 GitHub main canonical OCR 693개 전체 순번 (원문 인덱스 재조회; 운영 승인 목록 아님)</summary>

1. `account_garnishment::account_holder`
2. `account_garnishment::account_id`
3. `account_garnishment::court_or_authority`
4. `account_garnishment::creditor`
5. `account_garnishment::effective_date`
6. `account_garnishment::garnishment_amount`
7. `account_garnishment::issue_date`
8. `account_garnishment::released_amount`
9. `account_garnishment::seized_amount`
10. `account_garnishment::status`
11. `accounting_source::account_name`
12. `accounting_source::closing_balance`
13. `accounting_source::credits`
14. `accounting_source::debits`
15. `accounting_source::entity`
16. `accounting_source::issue_date`
17. `accounting_source::opening_balance`
18. `accounting_source::period_end`
19. `accounting_source::period_start`
20. `accounting_source::source_total`
21. `applicant_narrative_statement::identity.statement.admission_or_correction`
22. `applicant_narrative_statement::identity.statement.author`
23. `applicant_narrative_statement::identity.statement.event_end`
24. `applicant_narrative_statement::identity.statement.event_start`
25. `applicant_narrative_statement::identity.statement.narrative_text`
26. `applicant_narrative_statement::identity.statement.signature_status`
27. `applicant_narrative_statement::identity.statement.signed_at`
28. `applicant_narrative_statement::identity.statement.source_references`
29. `applicant_narrative_statement::identity.statement.statement_version`
30. `applicant_narrative_statement::identity.statement.topic`
31. `application_identity_venue::procedure.application.accepted_at`
32. `application_identity_venue::procedure.application.address`
33. `application_identity_venue::procedure.application.applicant_name`
34. `application_identity_venue::procedure.application.case_number`
35. `application_identity_venue::procedure.application.court`
36. `application_identity_venue::procedure.application.jurisdiction_exception`
37. `application_identity_venue::procedure.application.ordinary_venue_basis`
38. `application_identity_venue::procedure.application.phone_home`
39. `application_identity_venue::procedure.application.phone_mobile`
40. `application_identity_venue::procedure.application.phone_work`
41. `application_identity_venue::procedure.application.resident_id`
42. `application_identity_venue::procedure.application.ruleset_id`
43. `application_identity_venue::procedure.application.submitted_at`
44. `application_identity_venue::procedure.application.transition_rule`
45. `application_identity_venue::procedure.application_date`
46. `application_identity_venue::procedure.venue`
47. `asset_transfer_disposition::asset_id`
48. `asset_transfer_disposition::consideration`
49. `asset_transfer_disposition::market_value`
50. `asset_transfer_disposition::proceeds_received`
51. `asset_transfer_disposition::registration_date`
52. `asset_transfer_disposition::relationship`
53. `asset_transfer_disposition::review_status`
54. `asset_transfer_disposition::transaction_date`
55. `asset_transfer_disposition::transferee`
56. `asset_transfer_disposition::transferor`
57. `asset_transfer_disposition::use_of_proceeds`
58. `bank_account_balance::account_holder`
59. `bank_account_balance::account_id`
60. `bank_account_balance::account_status`
61. `bank_account_balance::balance`
62. `bank_account_balance::balance_as_of`
63. `bank_account_balance::currency`
64. `bank_account_balance::institution`
65. `bank_account_balance::issue_date`
66. `bank_transactions::account_id`
67. `bank_transactions::amount`
68. `bank_transactions::counterparty`
69. `bank_transactions::direction`
70. `bank_transactions::issue_date`
71. `bank_transactions::memo`
72. `bank_transactions::period_end`
73. `bank_transactions::period_start`
74. `bank_transactions::post_balance`
75. `bank_transactions::transaction_datetime`
76. `bank_transactions::transaction_id`
77. `bank_transactions::transaction_nature`
78. `business_asset_inventory::acquisition_date`
79. `business_asset_inventory::book_value`
80. `business_asset_inventory::condition`
81. `business_asset_inventory::disposal_restriction`
82. `business_asset_inventory::goodwill_contract`
83. `business_asset_inventory::market_value`
84. `business_asset_inventory::quantity`
85. `business_asset_inventory::quantity_unit`
86. `business_assets_liabilities::as_of_date`
87. `business_assets_liabilities::asset_or_claim_id`
88. `business_assets_liabilities::business_entity`
89. `business_assets_liabilities::gross_value`
90. `business_assets_liabilities::item_kind`
91. `business_assets_liabilities::ownership_interest`
92. `business_assets_liabilities::payable_amount`
93. `business_assets_liabilities::period_end`
94. `business_assets_liabilities::period_start`
95. `business_assets_liabilities::receivable_amount`
96. `business_assets_liabilities::secured_payoff`
97. `business_costs_and_ledgers::income.business_cost.accounting_basis`
98. `business_costs_and_ledgers::income.business_cost.business_continuity_flag`
99. `business_costs_and_ledgers::income.business_cost.business_entity`
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

</details>
