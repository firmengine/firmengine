# FirmEngine AX A3 — r113 OCR #421–430 소송·집행 원천 피처 전수 소비처 감사

작성 기준: 2026-11-04 05:30 KST. 참조 `main` HEAD: `53b0b77cc6530f0a1794d9509e2cfc62c23848b6`; 아래 원천 전부 이 정확 SHA에서 조회. 변경 범위 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 한정. **실 사건·개인정보·원본 OCR 값·비공개 정답·키/.env 없음**.

## 직전 회차와 진행 축
- 직전 r112에서 #411–420 완료된 *정적 부분 조사* 인계. 이번 #421–430 10 ID/20 문서×피처 슬롯 실제 조회. 다음 #431. 역할 **변호사→데이터→IT→사용자·서류→계산사무장→AX** 순환 (실무자 실제 승인 대리하지 않음).
- 중앙 보드 미완료 5 IDs: `A3-LAW-003`, `A3-DATA-008`, `A3-IT-003`, `A3-DOC-015`, `A3-CALC-005`. 모두 [ ] 유지.
- 조회 시 최근 메인 HEAD: `53b0b77cc6530f0a1794d9509e2cfc62c23848b6`, 직전 r112 HEAD `d0a5dd35ae4043b3ad46c2167cea8efe88a00ee5`에서 4커밋 추가(A1/A2 문서 및 중앙보드 수정 포함). 최근 오픈 Draft PR #229/#228/#227는 A2 축; A3 기간/OCR #51/#169는 아직 Draft. 중복 운영 코드 수정 없음.

## 검증 구분

| 레벨 | 이번 증빙 | 판정 |
|---|---|---|
| GitHub 정적 인덱스·관련 스키마·실제 코드 | 원천 SHA 고정 조회, 아래 정적 불변식 **33/33** 기대 일치 | 정적 계약 확인 |
| 원본 로컬 검사 함수 V8 격리 | 합성 입력 **88/88** 기존 코드 반환 재현(외부 금액 정규화 stub) | 로컬 분기 재현, **업무 정확성 합격 아님** |
| Node 전체 CI / 실제 D1 Fact·typed / staging D1·R2·Cron | 미실행 | 미인증 |
| 실제 원본 OCR 문서·페이지·bbox·복수행 / 공식 법원 서식 | 미조회 | 미인증 |
| 법률/관할/시행일·담당변호사 인정/실무자 승인 | 미실행 | **승인 0%** |
| 사이트 배포 / 운영 DB 이관 / 전자제출 / 법원 인가 | 실행 금지, 미실행 | 미실행 |

## 최신 정적 카탈로그 실제 재계수
- 693 canonical ID (중복 0), 85 문서, 48 패밀리, 141 문서×패밀리 라우트, 1,808 원천 슬롯 (동일 문서·패밀리 내 ID 중복 0).
- 계산 18 모듈 / 입력 선언 91 / 고유 경로 78. 위험 95 / 법률규칙 50 / 예외 46. `LEGAL_EVIDENCE_POLICY_SEED.checks=[]`이며 운영 편집형 법률 계약은 미조회. 인가·승인 자동 추론 금지.
- #421–430 원천: `litigation_enforcement`의 2 문서, `litigation_record`의 해당 패밀리 11 필드 및 `receivable_collectability`의 해당 패밀리 18 필드(7개 문서 확장 포함). **대상 10 ID는 두 문서 모두 있어 20 슬롯**. 각 문서는 원천 문서ID·주체·사건/항목ID·기간·원천행 순번으로 복수행 분리, summary vs detail 중복금지, 타 기록의 값 차용금지 규칙을 선언. 실제 원본 값/페이지·증거 실측 0건.
- DB 스키마 `extracted_features`의 `canonical_field_id/raw_value_json/source_state/quote/bbox_json/projection_key`, `feature-lineage-audit.ts`의 `document_id/page/record_ordinal/field_ordinal/source_sha256` 연결 코드는 이전 r112 및 이번 해당 카탈로그에서 경계 재확인. 실 DB 저장·리드백 미실행.
- `module-contracts.generated.json.fieldCrosswalk`의 해당 10 ID는 모두 `consumerMapping.status=source_only`. `canonical-field-binding.ts`의 exact typed 0, `material-calculation-source-gate.ts`의 exact material 0, `ocr-chain-matrix.ts`의 exact 공식 서식 token 후보/직접 계산 0, 95/50/46의 exact ID 정적 소비 0. 동적 런타임 사용처 부재 **증명 아님**. `D5106` 등 서식은 의미상 후보일 뿐 자동 승인된 직접 binding 아님.
- 갈음 경로 `document-substitution.ts`, 법원보정 `preapproval-correction-item-store.ts`의 수동 `requiredCanonicalFieldIds`는 존재하나 **#421–430 실제 도달 0건 관찰/미인증**. source-only를 무용/자동폐기 판단하지 않음. 법적 필요 요건 미등록·미승인 시 0% 합격.

## ID별 증거·계산·법률·양식 소비처 및 공백

모든 행의 문서 2종(`litigation_record`, `receivable_collectability`)에서 원본 문서/페이지/행·원문인용/bbox/hash·단위·당사자·기간·사건ID를 **같은 판본의 증거로** 확인해야 한다. 아래 직접 소비처 0은 코드상의 정확 매핑 한정이며 동적/사람 검토 경로의 0건 확정을 의미하지 않는다.

| # | canonical | 자료형 · 단위 · 시간역할 | 적용조건 | 직접 typed / material / 산식 / token / 법률 | 원천 보존·역질문 및 승인전 공백 |
|---:|---|---|---|---|---|
| 421 | `litigation_enforcement::claim_type` | category · not_applicable · not_applicable | `source_conditional` (등록≠법률승인) | 0 / 0 / 0 / 0 / 0 (exact) | 청구의 종류(판결/압류/추심/전부 등)를 판결·집행효력과 혼동하지 않는다. 원문 주문과 신청인 채무 여부 분리. |
| 422 | `litigation_enforcement::claimed_amount` | money · currency and exact source unit if monetary · not_applicable | `source_conditional` (등록≠법률승인) | 0 / 0 / 0 / 0 / 0 (exact) | 채권자가 주장한 청구액; 판결금·실집행금·현재 채무원금과 합산/차감 금지. 청구범위/이자/비용/통화 확인. |
| 423 | `litigation_enforcement::court_or_authority` | party_role · not_applicable · not_applicable | `source_conditional` (등록≠법률승인) | 0 / 0 / 0 / 0 / 0 (exact) | 법원 또는 집행기관. 개인회생 관할·사건종류와 일치한다고 간주 금지; 사건번호/발급주체 확인. |
| 424 | `litigation_enforcement::enforced_amount` | money · currency and exact source unit if monetary · not_applicable | `source_conditional` (등록≠법률승인) | 0 / 0 / 0 / 0 / 0 (exact) | 실제 집행 또는 회수된 액수인지 확인. 판결금보다 작은/큰 경우에도 채무잔액을 자동 조정하지 않는다. |
| 425 | `litigation_enforcement::event_date` | date · source date format normalized to ISO without loss · event_date | `source_conditional` (등록≠법률승인) | 0 / 0 / 0 / 0 / 0 (exact) | 해당 법적 사건의 발생일. 문서 발급일/송달일/판결확정일/집행종료일로 자동 승격 금지. |
| 426 | `litigation_enforcement::issue_date` | date · source date format normalized to ISO without loss · document_issue_date | `source_conditional` (등록≠법률승인) | 0 / 0 / 0 / 0 / 0 (exact) | 해당 문서의 발급일. 사건발생일과 구별, 증빙 유효성과 법적 효력은 별도 판단. |
| 427 | `litigation_enforcement::judgment_amount` | money · currency and exact source unit if monetary · not_applicable | `source_conditional` (등록≠법률승인) | 0 / 0 / 0 / 0 / 0 (exact) | 판결 주문상 금액이며 확정/집행력/지연이자 포함 여부 불명. 현재 잔액과 중복 합산 금지. |
| 428 | `litigation_enforcement::parties` | party_role · not_applicable · not_applicable | `source_conditional` (등록≠법률승인) | 0 / 0 / 0 / 0 / 0 (exact) | 원고·피고·채권자·채무자와 공동 당사자를 같은 식별자로 뭉개지 않는다. 현재 채권자도 별도 확인. |
| 429 | `litigation_enforcement::security_or_attachment` | category · not_applicable · not_applicable | `source_conditional` (등록≠법률승인) | 0 / 0 / 0 / 0 / 0 (exact) | 압류·담보·제한의 대상 물건/계좌·권리자·금액·순위·해제 시점 확인. 청산가치/채무 자동 반영 금지. |
| 430 | `litigation_enforcement::status` | category · not_applicable · not_applicable | `source_conditional` (등록≠법률승인) | 0 / 0 / 0 / 0 / 0 (exact) | 원천 기재 진행상태(정지/해제/계속/종결 등)와 확정 법적 상태 구별. 임의 enum 로컬 허용. |

## 독립 정적 불변식 — 33/33

| # | 검증 명제 | 독립 기대 | 실제 판정 |
|---:|---|---|---|
| 1 | index count | true | true — 일치 |
| 2 | index no duplicates | true | true — 일치 |
| 3 | 85 document definitions | true | true — 일치 |
| 4 | 48 families | true | true — 일치 |
| 5 | 141 document/family routes | true | true — 일치 |
| 6 | 1808 source field slots | true | true — 일치 |
| 7 | no repeated canonical IDs within one doc/family | true | true — 일치 |
| 8 | target 10 ordered | true | true — 일치 |
| 9 | target in two documents | true | true — 일치 |
| 10 | both document routes include all 10 | true | true — 일치 |
| 11 | both routes separate records | true | true — 일치 |
| 12 | both route summary not detail | true | true — 일치 |
| 13 | each field is canonical | true | true — 일치 |
| 14 | each field declares source page/row/quote anchor | true | true — 일치 |
| 15 | each field declares unit | true | true — 일치 |
| 16 | each field declares subject role | true | true — 일치 |
| 17 | each field declares temporal role | true | true — 일치 |
| 18 | each field applicability is registered | true | true — 일치 |
| 19 | each field has crosswalk metadata | true | true — 일치 |
| 20 | each field crosswalk remains source_only | true | true — 일치 |
| 21 | no exact target code in typed binding | true | true — 일치 |
| 22 | no exact target material destination | true | true — 일치 |
| 23 | no exact target form binding | true | true — 일치 |
| 24 | no exact target static legal ID | true | true — 일치 |
| 25 | 95 risk checks | true | true — 일치 |
| 26 | 50 legal rules | true | true — 일치 |
| 27 | 46 exceptions | true | true — 일치 |
| 28 | 18 calculation modules | true | true — 일치 |
| 29 | 91 declared module inputs | true | true — 일치 |
| 30 | 78 unique input paths | true | true — 일치 |
| 31 | legal evidence seed unapproved/empty | true | true — 일치 |
| 32 | 124 board A3 IDs | true | true — 일치 |
| 33 | 124 board A3 IDs all unchecked | true | true — 일치 |

## 로컬 함수 합성 V8 반환시험 — 88/88

원본 `lib/ocr-calculation-input.ts`의 `calculationSourceCellIssues()`에서 import·TS 타입 선언만 제거 후 JS V8 실행. 외부 `normalizeMoney` 의존성만 합성으로 대체(KRW+정수 문자열일 때 exact). 따라서 **실제 금액 정규화나 업무 전체 CI 검증 아님**. 아래 expected는 독립 작성된 기존 로컬 분기 기대코드이고, `[]`는 법률·계산상 허용이라는 의미가 아님.

**업무상 반례/확인 필요**: #422 청구액, #427 판결액, #424 실제 집행액은 서로 더할 금액이 아니며 채권/당사자/선후관계·상환/비용 확인 필요. 세 금액의 입력 `KRW`와 원문 `USD` 상충은 본 함수에서 미검출. #421/#429/#430 미등록 category 허용. #425 사건일 ≠ #426 발급일. 미관찰·null·명시적0·비해당·상충·source-only·승인전을 구분하고 무단 원화 합산 금지. 상위 게이트의 차단 동작은 **미관찰**.

| # | canonical | 시험명 | 합성 입력 | expected(local) | observed | 판정 |
|---:|---|---|---|---|---|---|
| 1 | `litigation_enforcement::claim_type` | baseline | `{"value":"SYNTHETIC","unit":null,"quote":"SYNTHETIC","sourceState":"present"}` | `[]` | `[]` | 현행 반환 일치 |
| 2 | `litigation_enforcement::claim_type` | quote_missing | `{"value":"SYNTHETIC","unit":null,"quote":"","sourceState":"present"}` | `["SOURCE_QUOTE_MISSING"]` | `["SOURCE_QUOTE_MISSING"]` | 현행 반환 일치 |
| 3 | `litigation_enforcement::claim_type` | present_null | `{"value":null,"unit":null,"quote":"SYNTHETIC","sourceState":"present"}` | `["SOURCE_PRESENT_VALUE_MISSING"]` | `["SOURCE_PRESENT_VALUE_MISSING"]` | 현행 반환 일치 |
| 4 | `litigation_enforcement::claim_type` | unknown_null | `{"value":null,"unit":null,"quote":null,"sourceState":"unknown"}` | `[]` | `[]` | 현행 반환 일치 |
| 5 | `litigation_enforcement::claim_type` | explicit_none_null | `{"value":null,"unit":null,"quote":null,"sourceState":"explicit_none"}` | `[]` | `[]` | 현행 반환 일치 |
| 6 | `litigation_enforcement::claim_type` | conflicting_null | `{"value":null,"unit":null,"quote":null,"sourceState":"conflicting"}` | `[]` | `[]` | 현행 반환 일치 |
| 7 | `litigation_enforcement::claim_type` | uncertain_confidence | `{"value":"SYNTHETIC","unit":null,"quote":"SYNTHETIC","sourceState":"present","confidence":"uncertain"}` | `["SOURCE_READ_UNCERTAIN"]` | `["SOURCE_READ_UNCERTAIN"]` | 현행 반환 일치 |
| 8 | `litigation_enforcement::claim_type` | unregistered_category | `{"value":"UNKNOWN_CATEGORY","unit":null,"quote":"UNKNOWN_CATEGORY","sourceState":"present"}` | `[]` | `[]` | 현행 반환 일치 |
| 9 | `litigation_enforcement::claimed_amount` | baseline | `{"value":"100","unit":"KRW","quote":"100","sourceState":"present"}` | `[]` | `[]` | 현행 반환 일치 |
| 10 | `litigation_enforcement::claimed_amount` | quote_missing | `{"value":"100","unit":"KRW","quote":"","sourceState":"present"}` | `["SOURCE_QUOTE_MISSING"]` | `["SOURCE_QUOTE_MISSING"]` | 현행 반환 일치 |
| 11 | `litigation_enforcement::claimed_amount` | present_null | `{"value":null,"unit":"KRW","quote":"100","sourceState":"present"}` | `["SOURCE_PRESENT_VALUE_MISSING"]` | `["SOURCE_PRESENT_VALUE_MISSING"]` | 현행 반환 일치 |
| 12 | `litigation_enforcement::claimed_amount` | unknown_null | `{"value":null,"unit":null,"quote":null,"sourceState":"unknown"}` | `[]` | `[]` | 현행 반환 일치 |
| 13 | `litigation_enforcement::claimed_amount` | explicit_none_null | `{"value":null,"unit":null,"quote":null,"sourceState":"explicit_none"}` | `[]` | `[]` | 현행 반환 일치 |
| 14 | `litigation_enforcement::claimed_amount` | conflicting_null | `{"value":null,"unit":null,"quote":null,"sourceState":"conflicting"}` | `[]` | `[]` | 현행 반환 일치 |
| 15 | `litigation_enforcement::claimed_amount` | uncertain_confidence | `{"value":"100","unit":"KRW","quote":"100","sourceState":"present","confidence":"uncertain"}` | `["SOURCE_READ_UNCERTAIN"]` | `["SOURCE_READ_UNCERTAIN"]` | 현행 반환 일치 |
| 16 | `litigation_enforcement::claimed_amount` | unit_missing | `{"value":"100","unit":null,"quote":"100","sourceState":"present"}` | `["SOURCE_MONETARY_UNIT_MISSING"]` | `["SOURCE_MONETARY_UNIT_MISSING"]` | 현행 반환 일치 |
| 17 | `litigation_enforcement::claimed_amount` | money_not_integer_stub | `{"value":"not_money","unit":"KRW","quote":"not_money","sourceState":"present"}` | `["SOURCE_MONEY_NOT_EXACT_KRW"]` | `["SOURCE_MONEY_NOT_EXACT_KRW"]` | 현행 반환 일치 |
| 18 | `litigation_enforcement::claimed_amount` | raw_quote_USD_input_KRW | `{"value":"100","unit":"KRW","quote":"100 USD","sourceState":"present"}` | `[]` | `[]` | 현행 반환 일치 |
| 19 | `litigation_enforcement::claimed_amount` | explicit_zero | `{"value":"0","unit":"KRW","quote":"0","sourceState":"present"}` | `[]` | `[]` | 현행 반환 일치 |
| 20 | `litigation_enforcement::court_or_authority` | baseline | `{"value":"SYNTHETIC","unit":null,"quote":"SYNTHETIC","sourceState":"present"}` | `[]` | `[]` | 현행 반환 일치 |
| 21 | `litigation_enforcement::court_or_authority` | quote_missing | `{"value":"SYNTHETIC","unit":null,"quote":"","sourceState":"present"}` | `["SOURCE_QUOTE_MISSING"]` | `["SOURCE_QUOTE_MISSING"]` | 현행 반환 일치 |
| 22 | `litigation_enforcement::court_or_authority` | present_null | `{"value":null,"unit":null,"quote":"SYNTHETIC","sourceState":"present"}` | `["SOURCE_PRESENT_VALUE_MISSING"]` | `["SOURCE_PRESENT_VALUE_MISSING"]` | 현행 반환 일치 |
| 23 | `litigation_enforcement::court_or_authority` | unknown_null | `{"value":null,"unit":null,"quote":null,"sourceState":"unknown"}` | `[]` | `[]` | 현행 반환 일치 |
| 24 | `litigation_enforcement::court_or_authority` | explicit_none_null | `{"value":null,"unit":null,"quote":null,"sourceState":"explicit_none"}` | `[]` | `[]` | 현행 반환 일치 |
| 25 | `litigation_enforcement::court_or_authority` | conflicting_null | `{"value":null,"unit":null,"quote":null,"sourceState":"conflicting"}` | `[]` | `[]` | 현행 반환 일치 |
| 26 | `litigation_enforcement::court_or_authority` | uncertain_confidence | `{"value":"SYNTHETIC","unit":null,"quote":"SYNTHETIC","sourceState":"present","confidence":"uncertain"}` | `["SOURCE_READ_UNCERTAIN"]` | `["SOURCE_READ_UNCERTAIN"]` | 현행 반환 일치 |
| 27 | `litigation_enforcement::enforced_amount` | baseline | `{"value":"100","unit":"KRW","quote":"100","sourceState":"present"}` | `[]` | `[]` | 현행 반환 일치 |
| 28 | `litigation_enforcement::enforced_amount` | quote_missing | `{"value":"100","unit":"KRW","quote":"","sourceState":"present"}` | `["SOURCE_QUOTE_MISSING"]` | `["SOURCE_QUOTE_MISSING"]` | 현행 반환 일치 |
| 29 | `litigation_enforcement::enforced_amount` | present_null | `{"value":null,"unit":"KRW","quote":"100","sourceState":"present"}` | `["SOURCE_PRESENT_VALUE_MISSING"]` | `["SOURCE_PRESENT_VALUE_MISSING"]` | 현행 반환 일치 |
| 30 | `litigation_enforcement::enforced_amount` | unknown_null | `{"value":null,"unit":null,"quote":null,"sourceState":"unknown"}` | `[]` | `[]` | 현행 반환 일치 |
| 31 | `litigation_enforcement::enforced_amount` | explicit_none_null | `{"value":null,"unit":null,"quote":null,"sourceState":"explicit_none"}` | `[]` | `[]` | 현행 반환 일치 |
| 32 | `litigation_enforcement::enforced_amount` | conflicting_null | `{"value":null,"unit":null,"quote":null,"sourceState":"conflicting"}` | `[]` | `[]` | 현행 반환 일치 |
| 33 | `litigation_enforcement::enforced_amount` | uncertain_confidence | `{"value":"100","unit":"KRW","quote":"100","sourceState":"present","confidence":"uncertain"}` | `["SOURCE_READ_UNCERTAIN"]` | `["SOURCE_READ_UNCERTAIN"]` | 현행 반환 일치 |
| 34 | `litigation_enforcement::enforced_amount` | unit_missing | `{"value":"100","unit":null,"quote":"100","sourceState":"present"}` | `["SOURCE_MONETARY_UNIT_MISSING"]` | `["SOURCE_MONETARY_UNIT_MISSING"]` | 현행 반환 일치 |
| 35 | `litigation_enforcement::enforced_amount` | money_not_integer_stub | `{"value":"not_money","unit":"KRW","quote":"not_money","sourceState":"present"}` | `["SOURCE_MONEY_NOT_EXACT_KRW"]` | `["SOURCE_MONEY_NOT_EXACT_KRW"]` | 현행 반환 일치 |
| 36 | `litigation_enforcement::enforced_amount` | raw_quote_USD_input_KRW | `{"value":"100","unit":"KRW","quote":"100 USD","sourceState":"present"}` | `[]` | `[]` | 현행 반환 일치 |
| 37 | `litigation_enforcement::enforced_amount` | explicit_zero | `{"value":"0","unit":"KRW","quote":"0","sourceState":"present"}` | `[]` | `[]` | 현행 반환 일치 |
| 38 | `litigation_enforcement::event_date` | baseline | `{"value":"2026-05-04","unit":null,"quote":"2026-05-04","sourceState":"present"}` | `[]` | `[]` | 현행 반환 일치 |
| 39 | `litigation_enforcement::event_date` | quote_missing | `{"value":"2026-05-04","unit":null,"quote":"","sourceState":"present"}` | `["SOURCE_QUOTE_MISSING"]` | `["SOURCE_QUOTE_MISSING"]` | 현행 반환 일치 |
| 40 | `litigation_enforcement::event_date` | present_null | `{"value":null,"unit":null,"quote":"2026-05-04","sourceState":"present"}` | `["SOURCE_PRESENT_VALUE_MISSING"]` | `["SOURCE_PRESENT_VALUE_MISSING"]` | 현행 반환 일치 |
| 41 | `litigation_enforcement::event_date` | unknown_null | `{"value":null,"unit":null,"quote":null,"sourceState":"unknown"}` | `[]` | `[]` | 현행 반환 일치 |
| 42 | `litigation_enforcement::event_date` | explicit_none_null | `{"value":null,"unit":null,"quote":null,"sourceState":"explicit_none"}` | `[]` | `[]` | 현행 반환 일치 |
| 43 | `litigation_enforcement::event_date` | conflicting_null | `{"value":null,"unit":null,"quote":null,"sourceState":"conflicting"}` | `[]` | `[]` | 현행 반환 일치 |
| 44 | `litigation_enforcement::event_date` | uncertain_confidence | `{"value":"2026-05-04","unit":null,"quote":"2026-05-04","sourceState":"present","confidence":"uncertain"}` | `["SOURCE_READ_UNCERTAIN"]` | `["SOURCE_READ_UNCERTAIN"]` | 현행 반환 일치 |
| 45 | `litigation_enforcement::event_date` | invalid_date | `{"value":"2026-02-30","unit":null,"quote":"2026-02-30","sourceState":"present"}` | `["SOURCE_DATE_INVALID"]` | `["SOURCE_DATE_INVALID"]` | 현행 반환 일치 |
| 46 | `litigation_enforcement::issue_date` | baseline | `{"value":"2026-05-04","unit":null,"quote":"2026-05-04","sourceState":"present"}` | `[]` | `[]` | 현행 반환 일치 |
| 47 | `litigation_enforcement::issue_date` | quote_missing | `{"value":"2026-05-04","unit":null,"quote":"","sourceState":"present"}` | `["SOURCE_QUOTE_MISSING"]` | `["SOURCE_QUOTE_MISSING"]` | 현행 반환 일치 |
| 48 | `litigation_enforcement::issue_date` | present_null | `{"value":null,"unit":null,"quote":"2026-05-04","sourceState":"present"}` | `["SOURCE_PRESENT_VALUE_MISSING"]` | `["SOURCE_PRESENT_VALUE_MISSING"]` | 현행 반환 일치 |
| 49 | `litigation_enforcement::issue_date` | unknown_null | `{"value":null,"unit":null,"quote":null,"sourceState":"unknown"}` | `[]` | `[]` | 현행 반환 일치 |
| 50 | `litigation_enforcement::issue_date` | explicit_none_null | `{"value":null,"unit":null,"quote":null,"sourceState":"explicit_none"}` | `[]` | `[]` | 현행 반환 일치 |
| 51 | `litigation_enforcement::issue_date` | conflicting_null | `{"value":null,"unit":null,"quote":null,"sourceState":"conflicting"}` | `[]` | `[]` | 현행 반환 일치 |
| 52 | `litigation_enforcement::issue_date` | uncertain_confidence | `{"value":"2026-05-04","unit":null,"quote":"2026-05-04","sourceState":"present","confidence":"uncertain"}` | `["SOURCE_READ_UNCERTAIN"]` | `["SOURCE_READ_UNCERTAIN"]` | 현행 반환 일치 |
| 53 | `litigation_enforcement::issue_date` | invalid_date | `{"value":"2026-02-30","unit":null,"quote":"2026-02-30","sourceState":"present"}` | `["SOURCE_DATE_INVALID"]` | `["SOURCE_DATE_INVALID"]` | 현행 반환 일치 |
| 54 | `litigation_enforcement::judgment_amount` | baseline | `{"value":"100","unit":"KRW","quote":"100","sourceState":"present"}` | `[]` | `[]` | 현행 반환 일치 |
| 55 | `litigation_enforcement::judgment_amount` | quote_missing | `{"value":"100","unit":"KRW","quote":"","sourceState":"present"}` | `["SOURCE_QUOTE_MISSING"]` | `["SOURCE_QUOTE_MISSING"]` | 현행 반환 일치 |
| 56 | `litigation_enforcement::judgment_amount` | present_null | `{"value":null,"unit":"KRW","quote":"100","sourceState":"present"}` | `["SOURCE_PRESENT_VALUE_MISSING"]` | `["SOURCE_PRESENT_VALUE_MISSING"]` | 현행 반환 일치 |
| 57 | `litigation_enforcement::judgment_amount` | unknown_null | `{"value":null,"unit":null,"quote":null,"sourceState":"unknown"}` | `[]` | `[]` | 현행 반환 일치 |
| 58 | `litigation_enforcement::judgment_amount` | explicit_none_null | `{"value":null,"unit":null,"quote":null,"sourceState":"explicit_none"}` | `[]` | `[]` | 현행 반환 일치 |
| 59 | `litigation_enforcement::judgment_amount` | conflicting_null | `{"value":null,"unit":null,"quote":null,"sourceState":"conflicting"}` | `[]` | `[]` | 현행 반환 일치 |
| 60 | `litigation_enforcement::judgment_amount` | uncertain_confidence | `{"value":"100","unit":"KRW","quote":"100","sourceState":"present","confidence":"uncertain"}` | `["SOURCE_READ_UNCERTAIN"]` | `["SOURCE_READ_UNCERTAIN"]` | 현행 반환 일치 |
| 61 | `litigation_enforcement::judgment_amount` | unit_missing | `{"value":"100","unit":null,"quote":"100","sourceState":"present"}` | `["SOURCE_MONETARY_UNIT_MISSING"]` | `["SOURCE_MONETARY_UNIT_MISSING"]` | 현행 반환 일치 |
| 62 | `litigation_enforcement::judgment_amount` | money_not_integer_stub | `{"value":"not_money","unit":"KRW","quote":"not_money","sourceState":"present"}` | `["SOURCE_MONEY_NOT_EXACT_KRW"]` | `["SOURCE_MONEY_NOT_EXACT_KRW"]` | 현행 반환 일치 |
| 63 | `litigation_enforcement::judgment_amount` | raw_quote_USD_input_KRW | `{"value":"100","unit":"KRW","quote":"100 USD","sourceState":"present"}` | `[]` | `[]` | 현행 반환 일치 |
| 64 | `litigation_enforcement::judgment_amount` | explicit_zero | `{"value":"0","unit":"KRW","quote":"0","sourceState":"present"}` | `[]` | `[]` | 현행 반환 일치 |
| 65 | `litigation_enforcement::parties` | baseline | `{"value":"SYNTHETIC","unit":null,"quote":"SYNTHETIC","sourceState":"present"}` | `[]` | `[]` | 현행 반환 일치 |
| 66 | `litigation_enforcement::parties` | quote_missing | `{"value":"SYNTHETIC","unit":null,"quote":"","sourceState":"present"}` | `["SOURCE_QUOTE_MISSING"]` | `["SOURCE_QUOTE_MISSING"]` | 현행 반환 일치 |
| 67 | `litigation_enforcement::parties` | present_null | `{"value":null,"unit":null,"quote":"SYNTHETIC","sourceState":"present"}` | `["SOURCE_PRESENT_VALUE_MISSING"]` | `["SOURCE_PRESENT_VALUE_MISSING"]` | 현행 반환 일치 |
| 68 | `litigation_enforcement::parties` | unknown_null | `{"value":null,"unit":null,"quote":null,"sourceState":"unknown"}` | `[]` | `[]` | 현행 반환 일치 |
| 69 | `litigation_enforcement::parties` | explicit_none_null | `{"value":null,"unit":null,"quote":null,"sourceState":"explicit_none"}` | `[]` | `[]` | 현행 반환 일치 |
| 70 | `litigation_enforcement::parties` | conflicting_null | `{"value":null,"unit":null,"quote":null,"sourceState":"conflicting"}` | `[]` | `[]` | 현행 반환 일치 |
| 71 | `litigation_enforcement::parties` | uncertain_confidence | `{"value":"SYNTHETIC","unit":null,"quote":"SYNTHETIC","sourceState":"present","confidence":"uncertain"}` | `["SOURCE_READ_UNCERTAIN"]` | `["SOURCE_READ_UNCERTAIN"]` | 현행 반환 일치 |
| 72 | `litigation_enforcement::security_or_attachment` | baseline | `{"value":"SYNTHETIC","unit":null,"quote":"SYNTHETIC","sourceState":"present"}` | `[]` | `[]` | 현행 반환 일치 |
| 73 | `litigation_enforcement::security_or_attachment` | quote_missing | `{"value":"SYNTHETIC","unit":null,"quote":"","sourceState":"present"}` | `["SOURCE_QUOTE_MISSING"]` | `["SOURCE_QUOTE_MISSING"]` | 현행 반환 일치 |
| 74 | `litigation_enforcement::security_or_attachment` | present_null | `{"value":null,"unit":null,"quote":"SYNTHETIC","sourceState":"present"}` | `["SOURCE_PRESENT_VALUE_MISSING"]` | `["SOURCE_PRESENT_VALUE_MISSING"]` | 현행 반환 일치 |
| 75 | `litigation_enforcement::security_or_attachment` | unknown_null | `{"value":null,"unit":null,"quote":null,"sourceState":"unknown"}` | `[]` | `[]` | 현행 반환 일치 |
| 76 | `litigation_enforcement::security_or_attachment` | explicit_none_null | `{"value":null,"unit":null,"quote":null,"sourceState":"explicit_none"}` | `[]` | `[]` | 현행 반환 일치 |
| 77 | `litigation_enforcement::security_or_attachment` | conflicting_null | `{"value":null,"unit":null,"quote":null,"sourceState":"conflicting"}` | `[]` | `[]` | 현행 반환 일치 |
| 78 | `litigation_enforcement::security_or_attachment` | uncertain_confidence | `{"value":"SYNTHETIC","unit":null,"quote":"SYNTHETIC","sourceState":"present","confidence":"uncertain"}` | `["SOURCE_READ_UNCERTAIN"]` | `["SOURCE_READ_UNCERTAIN"]` | 현행 반환 일치 |
| 79 | `litigation_enforcement::security_or_attachment` | unregistered_category | `{"value":"UNKNOWN_CATEGORY","unit":null,"quote":"UNKNOWN_CATEGORY","sourceState":"present"}` | `[]` | `[]` | 현행 반환 일치 |
| 80 | `litigation_enforcement::status` | baseline | `{"value":"SYNTHETIC","unit":null,"quote":"SYNTHETIC","sourceState":"present"}` | `[]` | `[]` | 현행 반환 일치 |
| 81 | `litigation_enforcement::status` | quote_missing | `{"value":"SYNTHETIC","unit":null,"quote":"","sourceState":"present"}` | `["SOURCE_QUOTE_MISSING"]` | `["SOURCE_QUOTE_MISSING"]` | 현행 반환 일치 |
| 82 | `litigation_enforcement::status` | present_null | `{"value":null,"unit":null,"quote":"SYNTHETIC","sourceState":"present"}` | `["SOURCE_PRESENT_VALUE_MISSING"]` | `["SOURCE_PRESENT_VALUE_MISSING"]` | 현행 반환 일치 |
| 83 | `litigation_enforcement::status` | unknown_null | `{"value":null,"unit":null,"quote":null,"sourceState":"unknown"}` | `[]` | `[]` | 현행 반환 일치 |
| 84 | `litigation_enforcement::status` | explicit_none_null | `{"value":null,"unit":null,"quote":null,"sourceState":"explicit_none"}` | `[]` | `[]` | 현행 반환 일치 |
| 85 | `litigation_enforcement::status` | conflicting_null | `{"value":null,"unit":null,"quote":null,"sourceState":"conflicting"}` | `[]` | `[]` | 현행 반환 일치 |
| 86 | `litigation_enforcement::status` | uncertain_confidence | `{"value":"SYNTHETIC","unit":null,"quote":"SYNTHETIC","sourceState":"present","confidence":"uncertain"}` | `["SOURCE_READ_UNCERTAIN"]` | `["SOURCE_READ_UNCERTAIN"]` | 현행 반환 일치 |
| 87 | `litigation_enforcement::status` | unregistered_category | `{"value":"UNKNOWN_CATEGORY","unit":null,"quote":"UNKNOWN_CATEGORY","sourceState":"present"}` | `[]` | `[]` | 현행 반환 일치 |
| 88 | `litigation_enforcement::claim_type` | missing_definition | `{"value":"XX","unit":null,"quote":null,"sourceState":"present"}` | `[]` | `[]` | 현행 반환 일치 |

## 미해결 처리와 다음 시작
- **LAW**: 소송/압류/추심/집행 사건 및 법률상 효력, 우선·별제권·채권자목록 등재/중복채권, 법원 주문·확정·송달·기준일과 실제 변호사 채택 미확인.
- **DATA/IT**: 같은 사건번호라도 당사자·자산·집행행이 다르면 원본 행 분리; 요약/세부액 중복사용 금지. 실제 문서·D1 Fact·typed·agent 단계·단수/복수 출력 미인증.
- **DOC/CALC**: 청구액/판결액/집행액은 각각 원천 의미만 저장; 실제 원금·이자·비용·집행 차감, D5106 공식 서식 및 갈음·법원보정 경로 검증 대기. 계산값 또는 법률상 확정값으로 승격 금지.
- **AX**: 소스 선언 존재와 실제 agent/tool call·테스트/CI/staging/서식/승인/배포 상태 절대 혼동 금지. 고위험 의미 변경은 별도 Draft PR+실무 검토. 이번에는 운영 코드·법률판단 수정/운영 배포·D1 migration·전자제출 없음.
- **다음 canonical #431 `loan_contract::contract_interest_rate` → #431–440**. 다음 역할 데이터→IT→사용자·서류→계산사무장→변호사→AX. A3 **0/124 최종 인수** 유지.

## 중앙 보드 A3 체크 ID — 최신 실제 순서 (124)

| 순번 | 체크 ID | 체크 |
|---:|---|---|
| 1 | `A3-IT-001` | 미완료 |
| 2 | `A3-IT-002` | 미완료 |
| 3 | `A3-IT-003` | 미완료 |
| 4 | `A3-IT-004` | 미완료 |
| 5 | `A3-IT-005` | 미완료 |
| 6 | `A3-IT-006` | 미완료 |
| 7 | `A3-IT-007` | 미완료 |
| 8 | `A3-IT-008` | 미완료 |
| 9 | `A3-IT-009` | 미완료 |
| 10 | `A3-IT-010` | 미완료 |
| 11 | `A3-IT-011` | 미완료 |
| 12 | `A3-IT-012` | 미완료 |
| 13 | `A3-IT-013` | 미완료 |
| 14 | `A3-IT-014` | 미완료 |
| 15 | `A3-IT-015` | 미완료 |
| 16 | `A3-IT-016` | 미완료 |
| 17 | `A3-IT-017` | 미완료 |
| 18 | `A3-IT-018` | 미완료 |
| 19 | `A3-IT-019` | 미완료 |
| 20 | `A3-IT-020` | 미완료 |
| 21 | `A3-DOC-001` | 미완료 |
| 22 | `A3-DOC-002` | 미완료 |
| 23 | `A3-DOC-003` | 미완료 |
| 24 | `A3-DOC-004` | 미완료 |
| 25 | `A3-DOC-005` | 미완료 |
| 26 | `A3-DOC-006` | 미완료 |
| 27 | `A3-DOC-007` | 미완료 |
| 28 | `A3-DOC-008` | 미완료 |
| 29 | `A3-DOC-009` | 미완료 |
| 30 | `A3-DOC-010` | 미완료 |
| 31 | `A3-DOC-011` | 미완료 |
| 32 | `A3-DOC-012` | 미완료 |
| 33 | `A3-DOC-013` | 미완료 |
| 34 | `A3-DOC-014` | 미완료 |
| 35 | `A3-DOC-015` | 미완료 |
| 36 | `A3-DOC-016` | 미완료 |
| 37 | `A3-DOC-017` | 미완료 |
| 38 | `A3-DOC-018` | 미완료 |
| 39 | `A3-DOC-019` | 미완료 |
| 40 | `A3-DOC-020` | 미완료 |
| 41 | `A3-CALC-001` | 미완료 |
| 42 | `A3-CALC-002` | 미완료 |
| 43 | `A3-CALC-003` | 미완료 |
| 44 | `A3-CALC-004` | 미완료 |
| 45 | `A3-CALC-005` | 미완료 |
| 46 | `A3-CALC-006` | 미완료 |
| 47 | `A3-CALC-007` | 미완료 |
| 48 | `A3-CALC-008` | 미완료 |
| 49 | `A3-CALC-009` | 미완료 |
| 50 | `A3-CALC-010` | 미완료 |
| 51 | `A3-CALC-011` | 미완료 |
| 52 | `A3-CALC-012` | 미완료 |
| 53 | `A3-CALC-013` | 미완료 |
| 54 | `A3-CALC-014` | 미완료 |
| 55 | `A3-CALC-015` | 미완료 |
| 56 | `A3-CALC-016` | 미완료 |
| 57 | `A3-CALC-017` | 미완료 |
| 58 | `A3-CALC-018` | 미완료 |
| 59 | `A3-CALC-019` | 미완료 |
| 60 | `A3-CALC-020` | 미완료 |
| 61 | `A3-LAW-001` | 미완료 |
| 62 | `A3-LAW-002` | 미완료 |
| 63 | `A3-LAW-003` | 미완료 |
| 64 | `A3-LAW-004` | 미완료 |
| 65 | `A3-LAW-005` | 미완료 |
| 66 | `A3-LAW-006` | 미완료 |
| 67 | `A3-LAW-007` | 미완료 |
| 68 | `A3-LAW-008` | 미완료 |
| 69 | `A3-LAW-009` | 미완료 |
| 70 | `A3-LAW-010` | 미완료 |
| 71 | `A3-LAW-011` | 미완료 |
| 72 | `A3-LAW-012` | 미완료 |
| 73 | `A3-LAW-013` | 미완료 |
| 74 | `A3-LAW-014` | 미완료 |
| 75 | `A3-LAW-015` | 미완료 |
| 76 | `A3-LAW-016` | 미완료 |
| 77 | `A3-LAW-017` | 미완료 |
| 78 | `A3-LAW-018` | 미완료 |
| 79 | `A3-LAW-019` | 미완료 |
| 80 | `A3-LAW-020` | 미완료 |
| 81 | `A3-LAW-021` | 미완료 |
| 82 | `A3-LAW-022` | 미완료 |
| 83 | `A3-DATA-001` | 미완료 |
| 84 | `A3-DATA-002` | 미완료 |
| 85 | `A3-DATA-003` | 미완료 |
| 86 | `A3-DATA-004` | 미완료 |
| 87 | `A3-DATA-005` | 미완료 |
| 88 | `A3-DATA-006` | 미완료 |
| 89 | `A3-DATA-007` | 미완료 |
| 90 | `A3-DATA-008` | 미완료 |
| 91 | `A3-DATA-009` | 미완료 |
| 92 | `A3-DATA-010` | 미완료 |
| 93 | `A3-DATA-011` | 미완료 |
| 94 | `A3-DATA-012` | 미완료 |
| 95 | `A3-DATA-013` | 미완료 |
| 96 | `A3-DATA-014` | 미완료 |
| 97 | `A3-DATA-015` | 미완료 |
| 98 | `A3-DATA-016` | 미완료 |
| 99 | `A3-DATA-017` | 미완료 |
| 100 | `A3-DATA-018` | 미완료 |
| 101 | `A3-DATA-019` | 미완료 |
| 102 | `A3-DATA-020` | 미완료 |
| 103 | `A3-DATA-021` | 미완료 |
| 104 | `A3-DATA-022` | 미완료 |
| 105 | `A3-AX-001` | 미완료 |
| 106 | `A3-AX-002` | 미완료 |
| 107 | `A3-AX-003` | 미완료 |
| 108 | `A3-AX-004` | 미완료 |
| 109 | `A3-AX-005` | 미완료 |
| 110 | `A3-AX-006` | 미완료 |
| 111 | `A3-AX-007` | 미완료 |
| 112 | `A3-AX-008` | 미완료 |
| 113 | `A3-AX-009` | 미완료 |
| 114 | `A3-AX-010` | 미완료 |
| 115 | `A3-AX-011` | 미완료 |
| 116 | `A3-AX-012` | 미완료 |
| 117 | `A3-AX-013` | 미완료 |
| 118 | `A3-AX-014` | 미완료 |
| 119 | `A3-AX-015` | 미완료 |
| 120 | `A3-AX-016` | 미완료 |
| 121 | `A3-AX-017` | 미완료 |
| 122 | `A3-AX-018` | 미완료 |
| 123 | `A3-AX-019` | 미완료 |
| 124 | `A3-AX-020` | 미완료 |

## canonical OCR 693개 — 최신 index 실제 순서

| 순번 | canonical ID |
|---:|---|
| 1 | `account_garnishment::account_holder` |
| 2 | `account_garnishment::account_id` |
| 3 | `account_garnishment::court_or_authority` |
| 4 | `account_garnishment::creditor` |
| 5 | `account_garnishment::effective_date` |
| 6 | `account_garnishment::garnishment_amount` |
| 7 | `account_garnishment::issue_date` |
| 8 | `account_garnishment::released_amount` |
| 9 | `account_garnishment::seized_amount` |
| 10 | `account_garnishment::status` |
| 11 | `accounting_source::account_name` |
| 12 | `accounting_source::closing_balance` |
| 13 | `accounting_source::credits` |
| 14 | `accounting_source::debits` |
| 15 | `accounting_source::entity` |
| 16 | `accounting_source::issue_date` |
| 17 | `accounting_source::opening_balance` |
| 18 | `accounting_source::period_end` |
| 19 | `accounting_source::period_start` |
| 20 | `accounting_source::source_total` |
| 21 | `applicant_narrative_statement::identity.statement.admission_or_correction` |
| 22 | `applicant_narrative_statement::identity.statement.author` |
| 23 | `applicant_narrative_statement::identity.statement.event_end` |
| 24 | `applicant_narrative_statement::identity.statement.event_start` |
| 25 | `applicant_narrative_statement::identity.statement.narrative_text` |
| 26 | `applicant_narrative_statement::identity.statement.signature_status` |
| 27 | `applicant_narrative_statement::identity.statement.signed_at` |
| 28 | `applicant_narrative_statement::identity.statement.source_references` |
| 29 | `applicant_narrative_statement::identity.statement.statement_version` |
| 30 | `applicant_narrative_statement::identity.statement.topic` |
| 31 | `application_identity_venue::procedure.application.accepted_at` |
| 32 | `application_identity_venue::procedure.application.address` |
| 33 | `application_identity_venue::procedure.application.applicant_name` |
| 34 | `application_identity_venue::procedure.application.case_number` |
| 35 | `application_identity_venue::procedure.application.court` |
| 36 | `application_identity_venue::procedure.application.jurisdiction_exception` |
| 37 | `application_identity_venue::procedure.application.ordinary_venue_basis` |
| 38 | `application_identity_venue::procedure.application.phone_home` |
| 39 | `application_identity_venue::procedure.application.phone_mobile` |
| 40 | `application_identity_venue::procedure.application.phone_work` |
| 41 | `application_identity_venue::procedure.application.resident_id` |
| 42 | `application_identity_venue::procedure.application.ruleset_id` |
| 43 | `application_identity_venue::procedure.application.submitted_at` |
| 44 | `application_identity_venue::procedure.application.transition_rule` |
| 45 | `application_identity_venue::procedure.application_date` |
| 46 | `application_identity_venue::procedure.venue` |
| 47 | `asset_transfer_disposition::asset_id` |
| 48 | `asset_transfer_disposition::consideration` |
| 49 | `asset_transfer_disposition::market_value` |
| 50 | `asset_transfer_disposition::proceeds_received` |
| 51 | `asset_transfer_disposition::registration_date` |
| 52 | `asset_transfer_disposition::relationship` |
| 53 | `asset_transfer_disposition::review_status` |
| 54 | `asset_transfer_disposition::transaction_date` |
| 55 | `asset_transfer_disposition::transferee` |
| 56 | `asset_transfer_disposition::transferor` |
| 57 | `asset_transfer_disposition::use_of_proceeds` |
| 58 | `bank_account_balance::account_holder` |
| 59 | `bank_account_balance::account_id` |
| 60 | `bank_account_balance::account_status` |
| 61 | `bank_account_balance::balance` |
| 62 | `bank_account_balance::balance_as_of` |
| 63 | `bank_account_balance::currency` |
| 64 | `bank_account_balance::institution` |
| 65 | `bank_account_balance::issue_date` |
| 66 | `bank_transactions::account_id` |
| 67 | `bank_transactions::amount` |
| 68 | `bank_transactions::counterparty` |
| 69 | `bank_transactions::direction` |
| 70 | `bank_transactions::issue_date` |
| 71 | `bank_transactions::memo` |
| 72 | `bank_transactions::period_end` |
| 73 | `bank_transactions::period_start` |
| 74 | `bank_transactions::post_balance` |
| 75 | `bank_transactions::transaction_datetime` |
| 76 | `bank_transactions::transaction_id` |
| 77 | `bank_transactions::transaction_nature` |
| 78 | `business_asset_inventory::acquisition_date` |
| 79 | `business_asset_inventory::book_value` |
| 80 | `business_asset_inventory::condition` |
| 81 | `business_asset_inventory::disposal_restriction` |
| 82 | `business_asset_inventory::goodwill_contract` |
| 83 | `business_asset_inventory::market_value` |
| 84 | `business_asset_inventory::quantity` |
| 85 | `business_asset_inventory::quantity_unit` |
| 86 | `business_assets_liabilities::as_of_date` |
| 87 | `business_assets_liabilities::asset_or_claim_id` |
| 88 | `business_assets_liabilities::business_entity` |
| 89 | `business_assets_liabilities::gross_value` |
| 90 | `business_assets_liabilities::item_kind` |
| 91 | `business_assets_liabilities::ownership_interest` |
| 92 | `business_assets_liabilities::payable_amount` |
| 93 | `business_assets_liabilities::period_end` |
| 94 | `business_assets_liabilities::period_start` |
| 95 | `business_assets_liabilities::receivable_amount` |
| 96 | `business_assets_liabilities::secured_payoff` |
| 97 | `business_costs_and_ledgers::income.business_cost.accounting_basis` |
| 98 | `business_costs_and_ledgers::income.business_cost.business_continuity_flag` |
| 99 | `business_costs_and_ledgers::income.business_cost.business_entity` |
| 100 | `business_costs_and_ledgers::income.business_cost.expense_category` |
| 101 | `business_costs_and_ledgers::income.business_cost.gross_amount` |
| 102 | `business_costs_and_ledgers::income.business_cost.payment_date` |
| 103 | `business_costs_and_ledgers::income.business_cost.payment_status` |
| 104 | `business_costs_and_ledgers::income.business_cost.period_end` |
| 105 | `business_costs_and_ledgers::income.business_cost.period_start` |
| 106 | `business_costs_and_ledgers::income.business_cost.supplier` |
| 107 | `business_costs_and_ledgers::income.business_cost.tax_component` |
| 108 | `business_current_income_summary::income.self_employment.business_costs` |
| 109 | `business_current_income_summary::income.self_employment.contract_end` |
| 110 | `business_current_income_summary::income.self_employment.contract_id` |
| 111 | `business_current_income_summary::income.self_employment.gross_receivable` |
| 112 | `business_current_income_summary::income.self_employment.invoice_date` |
| 113 | `business_current_income_summary::income.self_employment.net_receipt` |
| 114 | `business_current_income_summary::income.self_employment.operator` |
| 115 | `business_current_income_summary::income.self_employment.payer_customer` |
| 116 | `business_current_income_summary::income.self_employment.service_period_end` |
| 117 | `business_current_income_summary::income.self_employment.service_period_start` |
| 118 | `business_current_income_summary::income.self_employment.withheld_tax` |
| 119 | `business_registration::business_entity` |
| 120 | `business_registration::business_id` |
| 121 | `business_registration::business_items` |
| 122 | `business_registration::business_type` |
| 123 | `business_registration::issue_date` |
| 124 | `business_registration::joint_operators` |
| 125 | `business_registration::opening_date` |
| 126 | `business_registration::registration_date` |
| 127 | `business_registration::representative` |
| 128 | `business_registration::status` |
| 129 | `business_sales_vat::income.sales.business_entity` |
| 130 | `business_sales_vat::income.sales.exempt_sales` |
| 131 | `business_sales_vat::income.sales.filing_date` |
| 132 | `business_sales_vat::income.sales.gross_sales` |
| 133 | `business_sales_vat::income.sales.issue_date` |
| 134 | `business_sales_vat::income.sales.reporting_period_end` |
| 135 | `business_sales_vat::income.sales.reporting_period_start` |
| 136 | `business_sales_vat::income.sales.returns_refunds` |
| 137 | `business_sales_vat::income.sales.sales_count` |
| 138 | `business_sales_vat::income.sales.taxable_sales` |
| 139 | `business_sales_vat::income.sales.vat_collected` |
| 140 | `card_statement::billed_amount` |
| 141 | `card_statement::billing_period` |
| 142 | `card_statement::card_product_kind` |
| 143 | `card_statement::installment_count` |
| 144 | `card_statement::merchant` |
| 145 | `card_statement::purchase_amount` |
| 146 | `card_statement::remaining_installments` |
| 147 | `cash_deposit_asset::actual_payoff` |
| 148 | `cash_deposit_asset::as_of_date` |
| 149 | `cash_deposit_asset::asset_id` |
| 150 | `cash_deposit_asset::asset_kind` |
| 151 | `cash_deposit_asset::encumbrance` |
| 152 | `cash_deposit_asset::gross_value` |
| 153 | `cash_deposit_asset::owner` |
| 154 | `cash_deposit_asset::ownership_share` |
| 155 | `cash_deposit_asset::protected_or_excluded_claim` |
| 156 | `cash_deposit_asset::valuation_basis` |
| 157 | `cash_holding_statement::acquisition_source` |
| 158 | `cash_holding_statement::cash_currency` |
| 159 | `cash_holding_statement::declaration_author` |
| 160 | `cash_holding_statement::declaration_date` |
| 161 | `cash_holding_statement::storage_location` |
| 162 | `conditional_case_specific_request::conditional.court_request.case_number` |
| 163 | `conditional_case_specific_request::conditional.court_request.court` |
| 164 | `conditional_case_specific_request::conditional.court_request.item_due` |
| 165 | `conditional_case_specific_request::conditional.court_request.legal_citation` |
| 166 | `conditional_case_specific_request::conditional.court_request.operative_text` |
| 167 | `conditional_case_specific_request::conditional.court_request.request_type` |
| 168 | `conditional_case_specific_request::conditional.court_request.response_deadline` |
| 169 | `conditional_case_specific_request::conditional.court_request.response_filed_at` |
| 170 | `conditional_case_specific_request::conditional.court_request.service_date` |
| 171 | `conditional_case_specific_request::conditional.court_request.status_change` |
| 172 | `conditional_education_childcare::conditional.education.billed_amount` |
| 173 | `conditional_education_childcare::conditional.education.enrollment_end` |
| 174 | `conditional_education_childcare::conditional.education.enrollment_start` |
| 175 | `conditional_education_childcare::conditional.education.fee_type` |
| 176 | `conditional_education_childcare::conditional.education.frequency` |
| 177 | `conditional_education_childcare::conditional.education.paid_amount` |
| 178 | `conditional_education_childcare::conditional.education.payer` |
| 179 | `conditional_education_childcare::conditional.education.provider` |
| 180 | `conditional_education_childcare::conditional.education.recipient` |
| 181 | `conditional_education_childcare::conditional.education.relation` |
| 182 | `conditional_education_childcare::conditional.education.subsidy` |
| 183 | `conditional_medical_expense::conditional.medical.applicant_relation` |
| 184 | `conditional_medical_expense::conditional.medical.billed_cost` |
| 185 | `conditional_medical_expense::conditional.medical.care_period_end` |
| 186 | `conditional_medical_expense::conditional.medical.care_period_start` |
| 187 | `conditional_medical_expense::conditional.medical.expected_recurring_cost` |
| 188 | `conditional_medical_expense::conditional.medical.medical_opinion_period` |
| 189 | `conditional_medical_expense::conditional.medical.paid_cost` |
| 190 | `conditional_medical_expense::conditional.medical.patient` |
| 191 | `conditional_medical_expense::conditional.medical.provider` |
| 192 | `conditional_medical_expense::conditional.medical.reimbursement` |
| 193 | `conditional_medical_expense::conditional.medical.service_date` |
| 194 | `conditional_medical_expense::conditional.medical.service_kind` |
| 195 | `conditional_nonstandard_income_or_household_event::conditional.change.affected_person` |
| 196 | `conditional_nonstandard_income_or_household_event::conditional.change.duration_end` |
| 197 | `conditional_nonstandard_income_or_household_event::conditional.change.effective_date` |
| 198 | `conditional_nonstandard_income_or_household_event::conditional.change.event_date` |
| 199 | `conditional_nonstandard_income_or_household_event::conditional.change.event_kind` |
| 200 | `conditional_nonstandard_income_or_household_event::conditional.change.expense_delta` |
| 201 | `conditional_nonstandard_income_or_household_event::conditional.change.income_delta` |
| 202 | `conditional_nonstandard_income_or_household_event::conditional.change.issuer` |
| 203 | `conditional_nonstandard_income_or_household_event::conditional.change.new_status` |
| 204 | `conditional_nonstandard_income_or_household_event::conditional.change.old_status` |
| 205 | `conditional_plan_funding_source::applicability.form.current_official_version` |
| 206 | `conditional_plan_funding_source::applicability.form.disposition_asset_ids` |
| 207 | `conditional_plan_funding_source::applicability.form.disposition_date` |
| 208 | `conditional_plan_funding_source::applicability.form.disposition_proceeds` |
| 209 | `conditional_plan_funding_source::applicability.form.income_source_evidence_ids` |
| 210 | `conditional_plan_funding_source::applicability.form.plan_source` |
| 211 | `conditional_plan_funding_source::applicability.form.proceeds_to_plan` |
| 212 | `conditional_plan_funding_source::applicability.form.review_status` |
| 213 | `conditional_plan_funding_source::applicability.form.selected_form_code` |
| 214 | `credit_information_report::assignment_event_date` |
| 215 | `credit_information_report::current_reported_creditor` |
| 216 | `credit_information_report::event_record_id` |
| 217 | `credit_information_report::issue_date` |
| 218 | `credit_information_report::previous_creditor` |
| 219 | `credit_information_report::report_as_of` |
| 220 | `credit_information_report::report_subject` |
| 221 | `credit_report::currency_unit` |
| 222 | `credit_report::event_date` |
| 223 | `credit_report::event_kind` |
| 224 | `credit_report::institution` |
| 225 | `credit_report::product_code` |
| 226 | `credit_report::reported_amount` |
| 227 | `credit_report::status` |
| 228 | `creditor_assignment_dispute::assignment_date` |
| 229 | `creditor_assignment_dispute::claim_id` |
| 230 | `creditor_assignment_dispute::claim_status` |
| 231 | `creditor_assignment_dispute::current_claimant` |
| 232 | `creditor_assignment_dispute::dispute_basis` |
| 233 | `creditor_assignment_dispute::disputed_amount` |
| 234 | `creditor_assignment_dispute::notice_date` |
| 235 | `creditor_assignment_dispute::prior_creditor` |
| 236 | `creditor_assignment_dispute::supporting_record` |
| 237 | `crypto_balance::account_owner` |
| 238 | `crypto_balance::asset_symbol` |
| 239 | `crypto_balance::available_quantity` |
| 240 | `crypto_balance::average_acquisition_price` |
| 241 | `crypto_balance::displayed_valuation` |
| 242 | `crypto_balance::exchange_or_wallet` |
| 243 | `crypto_balance::locked_quantity` |
| 244 | `crypto_balance::network` |
| 245 | `crypto_balance::total_quantity` |
| 246 | `crypto_balance::valuation_currency` |
| 247 | `crypto_balance::valuation_datetime` |
| 248 | `crypto_balance::valuation_unit_price` |
| 249 | `crypto_balance::wallet_address` |
| 250 | `crypto_transactions::asset_symbol` |
| 251 | `crypto_transactions::completed_at` |
| 252 | `crypto_transactions::counterparty_account_identity` |
| 253 | `crypto_transactions::crypto_event_kind` |
| 254 | `crypto_transactions::destination_address` |
| 255 | `crypto_transactions::fee_asset` |
| 256 | `crypto_transactions::fee_quantity` |
| 257 | `crypto_transactions::gross_trade_amount` |
| 258 | `crypto_transactions::network` |
| 259 | `crypto_transactions::quantity` |
| 260 | `crypto_transactions::quote_currency` |
| 261 | `crypto_transactions::requested_at` |
| 262 | `crypto_transactions::source_address` |
| 263 | `crypto_transactions::transfer_status` |
| 264 | `crypto_transactions::txid` |
| 265 | `crypto_transactions::unit_price` |
| 266 | `current_nonwage_income::income.other.contract_end` |
| 267 | `current_nonwage_income::income.other.deductions` |
| 268 | `current_nonwage_income::income.other.earning_period_end` |
| 269 | `current_nonwage_income::income.other.earning_period_start` |
| 270 | `current_nonwage_income::income.other.frequency` |
| 271 | `current_nonwage_income::income.other.gross_amount` |
| 272 | `current_nonwage_income::income.other.income_kind` |
| 273 | `current_nonwage_income::income.other.net_received` |
| 274 | `current_nonwage_income::income.other.payer` |
| 275 | `current_nonwage_income::income.other.payment_date` |
| 276 | `current_nonwage_income::income.other.recipient` |
| 277 | `debt_certificate::as_of_date` |
| 278 | `debt_certificate::claim_cause` |
| 279 | `debt_certificate::contract_id` |
| 280 | `debt_certificate::contract_interest_rate` |
| 281 | `debt_certificate::creditor` |
| 282 | `debt_certificate::creditor_address` |
| 283 | `debt_certificate::debtor` |
| 284 | `debt_certificate::fees` |
| 285 | `debt_certificate::interest_balance` |
| 286 | `debt_certificate::issue_date` |
| 287 | `debt_certificate::issuer` |
| 288 | `debt_certificate::original_principal` |
| 289 | `debt_certificate::origination_date` |
| 290 | `debt_certificate::overdue_interest` |
| 291 | `debt_certificate::principal_balance` |
| 292 | `debt_certificate::total_claim` |
| 293 | `divorce_records::actual_support_paid` |
| 294 | `divorce_records::agreement_or_order_date` |
| 295 | `divorce_records::divorce_date` |
| 296 | `divorce_records::former_spouse` |
| 297 | `divorce_records::marriage_date` |
| 298 | `divorce_records::partition_amount` |
| 299 | `divorce_records::partition_asset` |
| 300 | `divorce_records::support_child` |
| 301 | `divorce_records::support_payer` |
| 302 | `divorce_records::support_period` |
| 303 | `divorce_records::support_periodic_amount` |
| 304 | `divorce_records::support_recipient` |
| 305 | `employment_contract::employer_signature_date` |
| 306 | `employment_contract::employer_signature_status` |
| 307 | `employment_history::insurance_scheme` |
| 308 | `employment_history::qualification_acquired` |
| 309 | `employment_history::qualification_lost` |
| 310 | `employment_history::qualification_record_scope` |
| 311 | `employment_history::qualification_type` |
| 312 | `employment_history::qualification_workplace` |
| 313 | `employment_relationship::income.employment.allowance_terms` |
| 314 | `employment_relationship::income.employment.base_wage` |
| 315 | `employment_relationship::income.employment.contract_term` |
| 316 | `employment_relationship::income.employment.employee` |
| 317 | `employment_relationship::income.employment.employer` |
| 318 | `employment_relationship::income.employment.employment_type` |
| 319 | `employment_relationship::income.employment.end_date` |
| 320 | `employment_relationship::income.employment.hours` |
| 321 | `employment_relationship::income.employment.issue_date` |
| 322 | `employment_relationship::income.employment.start_date` |
| 323 | `guarantee_joint_claim::applicant_role` |
| 324 | `guarantee_joint_claim::creditor` |
| 325 | `guarantee_joint_claim::dispute_status` |
| 326 | `guarantee_joint_claim::guarantee_claimed` |
| 327 | `guarantee_joint_claim::guarantee_limit` |
| 328 | `guarantee_joint_claim::principal_debtor` |
| 329 | `guarantee_joint_claim::recourse_status` |
| 330 | `guarantee_joint_claim::underlying_claim_id` |
| 331 | `health_insurance_arrears::as_of_date` |
| 332 | `health_insurance_arrears::authority` |
| 333 | `health_insurance_arrears::disposal_cost` |
| 334 | `health_insurance_arrears::issue_date` |
| 335 | `health_insurance_arrears::late_charge` |
| 336 | `health_insurance_arrears::period_end` |
| 337 | `health_insurance_arrears::period_start` |
| 338 | `health_insurance_arrears::subscriber` |
| 339 | `health_insurance_arrears::total_arrear` |
| 340 | `health_insurance_arrears::unpaid_contribution` |
| 341 | `household_composition_support::household.support.member` |
| 342 | `household_composition_support::household.support.other_income` |
| 343 | `household_composition_support::household.support.relationship` |
| 344 | `household_composition_support::household.support.residence_end` |
| 345 | `household_composition_support::household.support.residence_start` |
| 346 | `household_composition_support::household.support.support_amount` |
| 347 | `household_composition_support::household.support.support_frequency` |
| 348 | `household_composition_support::household.support.support_period_end` |
| 349 | `household_composition_support::household.support.support_period_start` |
| 350 | `household_composition_support::household.support.support_provider` |
| 351 | `household_composition_support::household.support.support_recipient` |
| 352 | `household_living_expense::household.expense.arrears` |
| 353 | `household_living_expense::household.expense.beneficiary` |
| 354 | `household_living_expense::household.expense.billed_amount` |
| 355 | `household_living_expense::household.expense.billing_period_end` |
| 356 | `household_living_expense::household.expense.billing_period_start` |
| 357 | `household_living_expense::household.expense.expense_kind` |
| 358 | `household_living_expense::household.expense.issue_date` |
| 359 | `household_living_expense::household.expense.paid_amount` |
| 360 | `household_living_expense::household.expense.payer` |
| 361 | `household_living_expense::household.expense.provider` |
| 362 | `household_living_expense::household.expense.shared_allocation` |
| 363 | `identity_residence_record::identity.address` |
| 364 | `identity_residence_record::identity.household_members` |
| 365 | `identity_residence_record::identity.issue_date` |
| 366 | `identity_residence_record::identity.marital_status` |
| 367 | `identity_residence_record::identity.name` |
| 368 | `identity_residence_record::identity.record_number` |
| 369 | `identity_residence_record::identity.registration_id` |
| 370 | `identity_residence_record::identity.relationship` |
| 371 | `income_source_inventory::amount_basis` |
| 372 | `income_source_inventory::income_source_id` |
| 373 | `income_source_inventory::reported_expenses` |
| 374 | `income_source_inventory::reported_gross` |
| 375 | `income_source_inventory::reported_net` |
| 376 | `income_source_inventory::source_document_reference` |
| 377 | `income_source_inventory::source_kind` |
| 378 | `inheritance_records::attributed_amount` |
| 379 | `inheritance_records::decedent` |
| 380 | `inheritance_records::disclaimer_or_limited_acceptance` |
| 381 | `inheritance_records::filing_or_order_reference` |
| 382 | `inheritance_records::heir` |
| 383 | `inheritance_records::heir_relationship` |
| 384 | `inheritance_records::inherited_asset_id` |
| 385 | `inheritance_records::partition_agreement_date` |
| 386 | `inheritance_records::stated_share` |
| 387 | `inheritance_records::succession_opened_at` |
| 388 | `insurance_policy_asset::as_of_date` |
| 389 | `insurance_policy_asset::beneficiary` |
| 390 | `insurance_policy_asset::contract_holder` |
| 391 | `insurance_policy_asset::coverage_amount` |
| 392 | `insurance_policy_asset::end_date` |
| 393 | `insurance_policy_asset::insured` |
| 394 | `insurance_policy_asset::insurer` |
| 395 | `insurance_policy_asset::issue_date` |
| 396 | `insurance_policy_asset::pledge` |
| 397 | `insurance_policy_asset::policy_id` |
| 398 | `insurance_policy_asset::policy_loan_balance` |
| 399 | `insurance_policy_asset::policy_status` |
| 400 | `insurance_policy_asset::premium_per_payment` |
| 401 | `insurance_policy_asset::refund_net_basis` |
| 402 | `insurance_policy_asset::start_date` |
| 403 | `insurance_policy_asset::surrender_value` |
| 404 | `insurance_policy_asset::total_premium` |
| 405 | `lease_contract::fixed_date` |
| 406 | `lease_housing::applicant_relation` |
| 407 | `lease_housing::arrears_deduction` |
| 408 | `lease_housing::deposit` |
| 409 | `lease_housing::issue_date` |
| 410 | `lease_housing::landlord` |
| 411 | `lease_housing::monthly_rent` |
| 412 | `lease_housing::period_end` |
| 413 | `lease_housing::period_start` |
| 414 | `lease_housing::property_id` |
| 415 | `lease_housing::renewal_status` |
| 416 | `lease_housing::secured_balance` |
| 417 | `lease_housing::security_assignment` |
| 418 | `lease_housing::tenant` |
| 419 | `lease_housing::use` |
| 420 | `litigation_enforcement::case_id` |
| 421 | `litigation_enforcement::claim_type` |
| 422 | `litigation_enforcement::claimed_amount` |
| 423 | `litigation_enforcement::court_or_authority` |
| 424 | `litigation_enforcement::enforced_amount` |
| 425 | `litigation_enforcement::event_date` |
| 426 | `litigation_enforcement::issue_date` |
| 427 | `litigation_enforcement::judgment_amount` |
| 428 | `litigation_enforcement::parties` |
| 429 | `litigation_enforcement::security_or_attachment` |
| 430 | `litigation_enforcement::status` |
| 431 | `loan_contract::contract_interest_rate` |
| 432 | `loan_contract::maturity_date` |
| 433 | `loan_contract::repayment_installments` |
| 434 | `loan_contract::repayment_method` |
| 435 | `loan_contract::scheduled_payment` |
| 436 | `local_tax::arrears` |
| 437 | `local_tax::as_of_date` |
| 438 | `local_tax::assessed_amount` |
| 439 | `local_tax::authority` |
| 440 | `local_tax::collection_cost` |
| 441 | `local_tax::issue_date` |
| 442 | `local_tax::paid_amount` |
| 443 | `local_tax::surcharge` |
| 444 | `local_tax::tax_base` |
| 445 | `local_tax::tax_period` |
| 446 | `local_tax::tax_type` |
| 447 | `local_tax::taxpayer` |
| 448 | `local_tax_assessment::jurisdiction_scope` |
| 449 | `local_tax_assessment::no_assessment_text` |
| 450 | `local_tax_assessment::row_or_subtotal_kind` |
| 451 | `local_tax_assessment::tax_assessment_year` |
| 452 | `local_tax_assessment::tax_notice_status` |
| 453 | `local_tax_assessment::tax_object` |
| 454 | `payroll_payslip::income.payroll.allowances` |
| 455 | `payroll_payslip::income.payroll.bonus` |
| 456 | `payroll_payslip::income.payroll.employee` |
| 457 | `payroll_payslip::income.payroll.employer` |
| 458 | `payroll_payslip::income.payroll.gross_base` |
| 459 | `payroll_payslip::income.payroll.hours_days` |
| 460 | `payroll_payslip::income.payroll.issue_date` |
| 461 | `payroll_payslip::income.payroll.net_pay` |
| 462 | `payroll_payslip::income.payroll.other_deductions` |
| 463 | `payroll_payslip::income.payroll.overtime` |
| 464 | `payroll_payslip::income.payroll.pay_date` |
| 465 | `payroll_payslip::income.payroll.pay_period_end` |
| 466 | `payroll_payslip::income.payroll.pay_period_start` |
| 467 | `payroll_payslip::income.payroll.social_contributions` |
| 468 | `payroll_payslip::income.payroll.tax_withheld` |
| 469 | `pension_benefit_income::income.benefit.beneficiary` |
| 470 | `pension_benefit_income::income.benefit.benefit_type` |
| 471 | `pension_benefit_income::income.benefit.decision_date` |
| 472 | `pension_benefit_income::income.benefit.deductions` |
| 473 | `pension_benefit_income::income.benefit.monthly_gross` |
| 474 | `pension_benefit_income::income.benefit.net_payment` |
| 475 | `pension_benefit_income::income.benefit.payment_date` |
| 476 | `pension_benefit_income::income.benefit.payment_end` |
| 477 | `pension_benefit_income::income.benefit.payment_start` |
| 478 | `pension_benefit_income::income.benefit.provider` |
| 479 | `pension_benefit_income::income.benefit.review_status` |
| 480 | `pension_contribution_benefit::as_of_date` |
| 481 | `pension_contribution_benefit::benefit_amount` |
| 482 | `pension_contribution_benefit::benefit_type` |
| 483 | `pension_contribution_benefit::contribution` |
| 484 | `pension_contribution_benefit::encumbrance` |
| 485 | `pension_contribution_benefit::issue_date` |
| 486 | `pension_contribution_benefit::member` |
| 487 | `pension_contribution_benefit::payment_start` |
| 488 | `pension_contribution_benefit::period_end` |
| 489 | `pension_contribution_benefit::period_start` |
| 490 | `pension_contribution_benefit::plan_id` |
| 491 | `pension_contribution_benefit::provider` |
| 492 | `pension_contribution_benefit::vested_balance` |
| 493 | `pension_contribution_benefit::withdrawal_value` |
| 494 | `pension_contribution_statement::contribution_record_kind` |
| 495 | `pension_contribution_statement::paid_amount` |
| 496 | `pension_contribution_statement::paid_months` |
| 497 | `pension_contribution_statement::payable_amount` |
| 498 | `pension_contribution_statement::payable_months` |
| 499 | `pension_contribution_statement::standard_monthly_income` |
| 500 | `pension_contribution_statement::subscriber_type` |
| 501 | `pension_contribution_statement::unpaid_amount` |
| 502 | `pension_contribution_statement::unpaid_months` |
| 503 | `pension_contribution_statement::unpayable_amount` |
| 504 | `pension_contribution_statement::unpayable_months` |
| 505 | `procedure_court_orders::procedure.order.case_number` |
| 506 | `procedure_court_orders::procedure.order.court` |
| 507 | `procedure_court_orders::procedure.order.deadline` |
| 508 | `procedure_court_orders::procedure.order.debtor` |
| 509 | `procedure_court_orders::procedure.order.effective_date` |
| 510 | `procedure_court_orders::procedure.order.finality` |
| 511 | `procedure_court_orders::procedure.order.operative_text` |
| 512 | `procedure_court_orders::procedure.order.order_date` |
| 513 | `procedure_court_orders::procedure.order.order_type` |
| 514 | `procedure_court_orders::procedure.order.scope` |
| 515 | `procedure_court_orders::procedure.order.service_date` |
| 516 | `procedure_court_orders::procedure.order.status_change` |
| 517 | `procedure_enforcement_garnishment::procedure.enforcement.asset_or_income` |
| 518 | `procedure_enforcement_garnishment::procedure.enforcement.attached_amount` |
| 519 | `procedure_enforcement_garnishment::procedure.enforcement.authority` |
| 520 | `procedure_enforcement_garnishment::procedure.enforcement.case_number` |
| 521 | `procedure_enforcement_garnishment::procedure.enforcement.claimed_amount` |
| 522 | `procedure_enforcement_garnishment::procedure.enforcement.creditor` |
| 523 | `procedure_enforcement_garnishment::procedure.enforcement.debtor` |
| 524 | `procedure_enforcement_garnishment::procedure.enforcement.effective_date` |
| 525 | `procedure_enforcement_garnishment::procedure.enforcement.order_date` |
| 526 | `procedure_enforcement_garnishment::procedure.enforcement.order_type` |
| 527 | `procedure_enforcement_garnishment::procedure.enforcement.released_amount` |
| 528 | `procedure_enforcement_garnishment::procedure.enforcement.service_date` |
| 529 | `procedure_enforcement_garnishment::procedure.enforcement.status` |
| 530 | `procedure_prior_insolvency::procedure.history.case_number` |
| 531 | `procedure_prior_insolvency::procedure.history.case_type` |
| 532 | `procedure_prior_insolvency::procedure.history.court_authority` |
| 533 | `procedure_prior_insolvency::procedure.history.debtor` |
| 534 | `procedure_prior_insolvency::procedure.history.discharge_date` |
| 535 | `procedure_prior_insolvency::procedure.history.filing_date` |
| 536 | `procedure_prior_insolvency::procedure.history.finality_date` |
| 537 | `procedure_prior_insolvency::procedure.history.order_date` |
| 538 | `procedure_prior_insolvency::procedure.history.order_kind` |
| 539 | `procedure_prior_insolvency::procedure.history.private_adjustment_attempt` |
| 540 | `procedure_prior_insolvency::procedure.history.record_issue_date` |
| 541 | `procedure_private_creditor_request::procedure.creditor_info.as_of_date` |
| 542 | `procedure_private_creditor_request::procedure.creditor_info.claim_id` |
| 543 | `procedure_private_creditor_request::procedure.creditor_info.claim_origin_date` |
| 544 | `procedure_private_creditor_request::procedure.creditor_info.creditor` |
| 545 | `procedure_private_creditor_request::procedure.creditor_info.debtor` |
| 546 | `procedure_private_creditor_request::procedure.creditor_info.interest_balance` |
| 547 | `procedure_private_creditor_request::procedure.creditor_info.interest_rate` |
| 548 | `procedure_private_creditor_request::procedure.creditor_info.principal_balance` |
| 549 | `procedure_private_creditor_request::procedure.creditor_info.principal_original` |
| 550 | `procedure_private_creditor_request::procedure.creditor_info.request_copy` |
| 551 | `procedure_private_creditor_request::procedure.creditor_info.request_date` |
| 552 | `procedure_private_creditor_request::procedure.creditor_info.response_date` |
| 553 | `property_search::issue_date` |
| 554 | `property_search::jurisdiction_scope` |
| 555 | `property_search::ownership_share` |
| 556 | `property_search::property_found` |
| 557 | `property_search::property_id` |
| 558 | `property_search::registered_owner` |
| 559 | `property_search::search_as_of` |
| 560 | `property_search::searched_subject` |
| 561 | `real_estate_register::ownership_change_text` |
| 562 | `real_estate_register::property_address` |
| 563 | `real_property_register::acquisition_date` |
| 564 | `real_property_register::issue_date` |
| 565 | `real_property_register::maximum_claim` |
| 566 | `real_property_register::mortgage_holder` |
| 567 | `real_property_register::ownership_share` |
| 568 | `real_property_register::property_id` |
| 569 | `real_property_register::property_type` |
| 570 | `real_property_register::registered_owner` |
| 571 | `real_property_register::registered_value` |
| 572 | `real_property_register::registration_date` |
| 573 | `real_property_register::release_date` |
| 574 | `real_property_valuation::actual_payoff` |
| 575 | `real_property_valuation::disposal_cost` |
| 576 | `real_property_valuation::market_value` |
| 577 | `real_property_valuation::owner` |
| 578 | `real_property_valuation::ownership_share` |
| 579 | `real_property_valuation::property_id` |
| 580 | `real_property_valuation::valuation_date` |
| 581 | `real_property_valuation::valuation_method` |
| 582 | `receivable_collectability::collected_amount` |
| 583 | `receivable_collectability::collection_status` |
| 584 | `receivable_collectability::counterparty_status` |
| 585 | `receivable_collectability::demand_date` |
| 586 | `receivable_collectability::receivable_id` |
| 587 | `receivable_collectability::security_reference` |
| 588 | `receivable_collectability::uncollected_reason` |
| 589 | `resident_registration::address_change_date` |
| 590 | `resident_registration::historical_address` |
| 591 | `resident_registration::residence_history_period` |
| 592 | `retirement_estimate::estimated_retirement_date` |
| 593 | `retirement_estimate::payout_condition` |
| 594 | `retirement_estimate::retirement_scheme` |
| 595 | `retirement_estimate::service_period` |
| 596 | `retirement_estimate::transfer_history` |
| 597 | `salary_statement::employer_confirmation_status` |
| 598 | `salary_statement::employer_signature_date` |
| 599 | `salary_statement::gross_total` |
| 600 | `salary_statement::total_deductions` |
| 601 | `secured_claim_security::actual_payoff` |
| 602 | `secured_claim_security::collateral_id` |
| 603 | `secured_claim_security::discharge_date` |
| 604 | `secured_claim_security::grantor` |
| 605 | `secured_claim_security::priority` |
| 606 | `secured_claim_security::registered_maximum` |
| 607 | `secured_claim_security::registration_date` |
| 608 | `secured_claim_security::secured_party` |
| 609 | `secured_claim_security::security_type` |
| 610 | `securities_balance::account_coverage` |
| 611 | `securities_balance::asset_class` |
| 612 | `securities_balance::cash_balance` |
| 613 | `securities_balance::quantity` |
| 614 | `securities_balance::quantity_unit` |
| 615 | `securities_balance::security_id` |
| 616 | `securities_balance::security_name` |
| 617 | `securities_balance::settlement_basis` |
| 618 | `securities_balance::unsettled_liability` |
| 619 | `securities_balance::valuation_currency` |
| 620 | `securities_balance::valuation_datetime` |
| 621 | `securities_balance::valuation_method` |
| 622 | `securities_balance::valuation_unit_price` |
| 623 | `securities_transactions::counter_account` |
| 624 | `securities_transactions::fee` |
| 625 | `securities_transactions::quantity` |
| 626 | `securities_transactions::quantity_unit` |
| 627 | `securities_transactions::security_event_kind` |
| 628 | `securities_transactions::security_id` |
| 629 | `securities_transactions::security_name` |
| 630 | `securities_transactions::settled_amount` |
| 631 | `securities_transactions::settlement_date` |
| 632 | `securities_transactions::tax` |
| 633 | `securities_transactions::trade_gross` |
| 634 | `securities_transactions::trade_unit_price` |
| 635 | `tax_income::arrears` |
| 636 | `tax_income::gross_receipts` |
| 637 | `tax_income::income_after_expenses` |
| 638 | `tax_income::income_kind` |
| 639 | `tax_income::issue_date` |
| 640 | `tax_income::necessary_expenses` |
| 641 | `tax_income::period_end` |
| 642 | `tax_income::period_start` |
| 643 | `tax_income::tax_assessed` |
| 644 | `tax_income::tax_paid` |
| 645 | `tax_income::tax_year` |
| 646 | `tax_income::taxpayer` |
| 647 | `tax_public_arrear::as_of_date` |
| 648 | `tax_public_arrear::assessment_date` |
| 649 | `tax_public_arrear::authority` |
| 650 | `tax_public_arrear::costs` |
| 651 | `tax_public_arrear::debtor` |
| 652 | `tax_public_arrear::due_date` |
| 653 | `tax_public_arrear::issue_date` |
| 654 | `tax_public_arrear::principal_arrear` |
| 655 | `tax_public_arrear::surcharge_interest` |
| 656 | `tax_public_arrear::tax_period` |
| 657 | `tax_public_arrear::tax_type` |
| 658 | `tax_public_arrear::total_due` |
| 659 | `vehicle_registration::model_year` |
| 660 | `vehicle_registration::plate_number` |
| 661 | `vehicle_registration::record_issue_date` |
| 662 | `vehicle_registration::vin` |
| 663 | `vehicle_registry::acquisition_date` |
| 664 | `vehicle_registry::co_owners` |
| 665 | `vehicle_registry::lien_date` |
| 666 | `vehicle_registry::lien_holder` |
| 667 | `vehicle_registry::ownership_share` |
| 668 | `vehicle_registry::registered_lien_amount` |
| 669 | `vehicle_registry::registered_owner` |
| 670 | `vehicle_registry::registration_status` |
| 671 | `vehicle_registry::release_date` |
| 672 | `vehicle_registry::transfer_date` |
| 673 | `vehicle_registry::vehicle_id` |
| 674 | `vehicle_valuation::actual_payoff` |
| 675 | `vehicle_valuation::market_value` |
| 676 | `vehicle_valuation::mileage` |
| 677 | `vehicle_valuation::model_year` |
| 678 | `vehicle_valuation::owner` |
| 679 | `vehicle_valuation::registered_lien_amount` |
| 680 | `vehicle_valuation::valuation_date` |
| 681 | `vehicle_valuation::valuation_method` |
| 682 | `vehicle_valuation::vehicle_id` |
| 683 | `wage_withholding_tax::income.tax.employment_start_end` |
| 684 | `wage_withholding_tax::income.tax.gross_wages` |
| 685 | `wage_withholding_tax::income.tax.issue_date` |
| 686 | `wage_withholding_tax::income.tax.resident_tax` |
| 687 | `wage_withholding_tax::income.tax.tax_exempt_allowances` |
| 688 | `wage_withholding_tax::income.tax.tax_year` |
| 689 | `wage_withholding_tax::income.tax.taxable_allowances` |
| 690 | `wage_withholding_tax::income.tax.taxpayer` |
| 691 | `wage_withholding_tax::income.tax.withheld_income_tax` |
| 692 | `wage_withholding_tax::income.tax.withholding_agent` |
| 693 | `wage_withholding_tax::income.tax.year_end_adjustment` |

## 조회 blob SHA

| 파일 | blob SHA |
|---|---|
| `lib/canonical-field-id-index.json` | `27ecdddd208de82a2f5c675e7482485e3a8838c2` |
| `lib/document-agent-field-contracts.json` | `9884b3fecf44643fefcdc4a421ed66ffc5477b3a` |
| `lib/shared-document-field-contracts.json` | `9decab974e0909ae24ad927bdfe241d75b71f3a9` |
| `lib/ocr-field-supplements.json` | `63b2bf853acb2e9620a6fb72377dc278ff3cd2a5` |
| `lib/field-applicability-contracts.json` | `6076b26f782c4643a21a7b2f1a8f6261bb588b68` |
| `lib/module-contracts.generated.json` | `46a395a763ac17ab8e66c492c26c8e20fc037f56` |
| `lib/risk-catalog.json` | `e96dd0926e3ae9be5a5573d4551538ba294c4d2e` |
| `lib/legal-catalog.json` | `b0898d74f1df69b19ecf6e81cdff0ed09e8d885e` |
| `lib/legal-exceptions.json` | `6e51197226bfd8320e1147d8df3f12c11e00927c` |
| `lib/ocr-calculation-input.ts` | `8f7f51bf41f7c944b76419d7cc894e49ac771473` |
| `lib/canonical-field-binding.ts` | `60ee5c7762d52b72a165b4f4f8214680eb98f148` |
| `lib/material-calculation-source-gate.ts` | `0286b44484913b63fa8ec3f7bf0ca59b034d0dab` |
| `lib/ocr-chain-matrix.ts` | `977de86ba698bd805cc6b95d1384e3b49d0dbb4c` |
| `lib/legal-evidence-criteria.ts` | `6c0b94535700d4fa4d356f8a91d5b9440b5ac52a` |
| `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` | `42517ca3755491fcdf33f6f9925e72650fd24dac` |
