# FirmEngine A3 제38차 — canonical #041–060 소비처 재감사 (2026-11-01 KST)

> 이번 실제 읽기 기준 GitHub `main` SHA `49c640530c8e6b4f3cbb3634518d4ea6f6cb47ba`; `lib/canonical-field-id-index.json` blob `27ecdddd208de82a2f5c675e7482485e3a8838c2`; `lib/feature-lineage-audit.ts` blob `de81bc3b8c460b8a4dde3fda9e13087e619e74ff`. 작업 경로는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 사건 원본/개인정보/원본 OCR 사실값/키/운영 데이터 미접근. 정적 선언·V8 원본 식 격리 실행 결과일 뿐 사람 승인·운영 인수 아님.

## 시작점과 역할·보드
- [37차 #021–040](20261101-r37-canonical-021-040-consumer-recheck-0123KST.md) 및 [3차 #041–060 최초 감사](20261030-1522-canonical-041-060.md)를 연결한 **재감사**. canonical index 순서대로 **#041–060, 20개 ID**, 다음 시작 **#061–080**.
- 이번 역할은 **변호사 → 서류담당자 → 데이터담당자 → AX담당자 → IT담당자**. A3 중앙 보드 체크 `A3-LAW-019`, `A3-DOC-009`, `A3-DATA-003`, `A3-AX-019`, `A3-IT-016` 각 부분 검증, 최종 `[ ]` 유지. **다음은 계산사무장부터** 순환.
- 조회한 자료: 본문 SHA에 고정된 canonical 인덱스, 48 OCR family 계약, 85 문서의 allowedFamily/recordPolicy/extension, 19 supplement, 적용조건, typed projection, material gate, 13 exact OCR→form 선언, 공식 서식 빌더, 18계산/91입력, 법률위험95/규칙50/예외46, 법률 증거 기준 seed, 693개 등록표, 직전 영수증 및 PR #22/#51/#99 개요. PR 상태는 검사 당시 Draft/open이며 인수 승인 아님.

## 입력·독립 기대값·실제 관찰·검증 등급
| 입력/기대 | 실제 관찰 | 상태/검증 등급 |
|---|---|---|
| 최신 인덱스 693 고유 ID, 85문서/48패밀리, 모든 문서·family+확장+supplement가 합쳐진 선언 1,808 슬롯 | **693/693 고유, 문서 85, family 48, 슬롯 1,808**, supplement 19; 등록표 693행 **순서 불일치 0** | **정적 데이터 계약 일치**. 원본 OCR 인식/DB 테스트 아님 |
| #041–060 정확 20개, application 6×1 + disposition 11×8 + bank 3×1 = 97 원천 슬롯, 10문서 | **20 ID / 97 슬롯 / 10 문서**, 대상 전부 base family 정의 1개·적용조건 정확 등록 1개 | **정적 조인 일치** |
| 각 ID의 가족 경로·원단위·기간·대상 일치; 문서별 페이지/행/인물 분리 정책 존재; 원문 미확인≠0 | **8개 불변식×20 ID = 160/160 실제 V8 단언 성공**; 97/97 원천 슬롯의 선언된 recordPolicy에 sourceOnly·noCrossRecordBorrowing·identityFields·splitOn 존재 | **정적 코드/계약만**. 실제 page/bbox/quote/record/sourceHash/subject 값 관찰 0건 |
| 기간·단위 판정은 원본 `feature-lineage-audit.ts` 술어 그대로 재구성하여 실행 | 기간 20회 중 true #043/#045/#051/#054(4), 단위 20회 중 true #048/#049/#050(3), **총 40회** | **V8 원본 술어 실행**. OCR 시간/통화 변환 승인 아님 |
| 정확 ID→typed/계산/서식/법률 승인 분리 | 직접 typed **0/20**, 계산 **must_reconcile 0**, **#050 context_only 1**, 정확 서식 토큰 **0/20**, 95위험의 정확 canonical 증거계약 **0/20**; 법률 evidence seed `checks:[]` | **정적 선언 확인**. 동적 승인 관리값·실제 CaseData 미조회 |
| 전체 18계산/91입력·위험95/법률규칙50/예외46 | 정확히 **18/91/95/50/46** 등록 조인 | **등록 개수 확인**, 실제 계산·판결·공식 서식 미인증 |
| 승인 정확 canonical 연결 0이면 후보 위험이 많아도 ‘미연결’ 경고 유지 | #047–057 위험후보 각 9, #058–060 각 3, #041–046 0. 총 14 ID에서 기존 `gaps`의 `risks.length` 식이 **승인근거 0인데 경고를 제거** | **원본 boolean 식 추출·V8 20건 평가**로 정적 경고 false-negative **14/20** 재현. 실제 전체 `buildFeatureLineageAudit`/Node/사건법률판단 미실행 |

## canonical ID별 원천·소비처 누적표
`기간/단위/적용`의 Y는 **현재 코드의 검사 후보/정확 계약 등록**일 뿐 실제 기간·통화·서류 법적 의무/확정값이 아님. `법률후보`는 문서→workflow→위험 간접 결합이며 승인된 정확 증거계약이 아님. 각 슬롯의 원본 문서ID/SHA·페이지·복수행·인용·대상 ID는 실제 자료를 쓰지 않았으므로 **미관찰**.

| # | canonical ID | 서류/슬롯 | 타입·원단위 | 대상·기간 | 기간/단위/적용 | typed / material / 서식 / 법률후보 / 법률승인 |
|---:|---|---|---|---|:---:|---|
| 41 | `application_identity_venue::procedure.application.resident_id` | 1종/1 | masked_identifier; not_applicable | applicant_debtor; not_applicable | N/N/Y | 0 / 0 / 0 / 0 / 0 |
| 42 | `application_identity_venue::procedure.application.ruleset_id` | 1종/1 | string; not_applicable | authority; not_applicable | N/N/Y | 0 / 0 / 0 / 0 / 0 |
| 43 | `application_identity_venue::procedure.application.submitted_at` | 1종/1 | datetime; not_applicable | applicant_debtor; application_filing_datetime | Y/N/Y | 0 / 0 / 0 / 0 / 0 |
| 44 | `application_identity_venue::procedure.application.transition_rule` | 1종/1 | text_or_enum; not_applicable | authority; not_applicable | N/N/Y | 0 / 0 / 0 / 0 / 0 |
| 45 | `application_identity_venue::procedure.application_date` | 1종/1 | date; not_applicable | court; application_filing_date | Y/N/Y | 0 / 0 / 0 / 0 / 0 |
| 46 | `application_identity_venue::procedure.venue` | 1종/1 | party_role; not_applicable | court; not_applicable | N/N/Y | 0 / 0 / 0 / 0 / 0 |
| 47 | `asset_transfer_disposition::asset_id` | 8종/8 | identifier; not_applicable | owner_legal; not_applicable | N/N/Y | 0 / 0 / 0 / 9 / 0 |
| 48 | `asset_transfer_disposition::consideration` | 8종/8 | money; currency and exact source unit if monetary | owner_legal; not_applicable | N/Y/Y | 0 / 0 / 0 / 9 / 0 |
| 49 | `asset_transfer_disposition::market_value` | 8종/8 | money; currency and exact source unit if monetary | owner_legal; not_applicable | N/Y/Y | 0 / 0 / 0 / 9 / 0 |
| 50 | `asset_transfer_disposition::proceeds_received` | 8종/8 | money; currency and exact source unit if monetary | owner_legal; not_applicable | N/Y/Y | 0 / context_only(대상없음) / 0 / 9 / 0 |
| 51 | `asset_transfer_disposition::registration_date` | 8종/8 | date; source date format normalized to ISO without loss | owner_legal; registration_effective_date | Y/N/Y | 0 / 0 / 0 / 9 / 0 |
| 52 | `asset_transfer_disposition::relationship` | 8종/8 | category; not_applicable | owner_legal; not_applicable | N/N/Y | 0 / 0 / 0 / 9 / 0 |
| 53 | `asset_transfer_disposition::review_status` | 8종/8 | category; not_applicable | owner_legal; not_applicable | N/N/Y | 0 / 0 / 0 / 9 / 0 |
| 54 | `asset_transfer_disposition::transaction_date` | 8종/8 | date; source date format normalized to ISO without loss | owner_legal; event_date | Y/N/Y | 0 / 0 / 0 / 9 / 0 |
| 55 | `asset_transfer_disposition::transferee` | 8종/8 | party_role; not_applicable | owner_legal; not_applicable | N/N/Y | 0 / 0 / 0 / 9 / 0 |
| 56 | `asset_transfer_disposition::transferor` | 8종/8 | party_role; not_applicable | owner_legal; not_applicable | N/N/Y | 0 / 0 / 0 / 9 / 0 |
| 57 | `asset_transfer_disposition::use_of_proceeds` | 8종/8 | category; not_applicable | owner_legal; not_applicable | N/N/Y | 0 / 0 / 0 / 9 / 0 |
| 58 | `bank_account_balance::account_holder` | 1종/1 | party_role; not_applicable | account_holder; not_applicable | N/N/Y | 0 / 0 / 0 / 3 / 0 |
| 59 | `bank_account_balance::account_id` | 1종/1 | identifier; not_applicable | account_holder; not_applicable | N/N/Y | 0 / 0 / 0 / 3 / 0 |
| 60 | `bank_account_balance::account_status` | 1종/1 | category; not_applicable | account_holder; not_applicable | N/N/Y | 0 / 0 / 0 / 3 / 0 |

### 관찰한 문서별 원천 분기
- 신청서 입력 `application_form_input`: #041–046 6개 × 1슬롯. 신청인 가림 주민번호·법원/기준판본/경과규정/제출시각·신청일은 **서로 다른 필드**. `form-mapping.ts` `application_date`의 현재 별도 소비처는 `data.context.applicationDate`; #045 canonical Fact의 직접 typed/서식 변환을 의미하지 않음.
- 자산 처분 `asset_transfer_disposition`: #047–057 11개 × 8문서 = 88슬롯. 해당 문서: `business_liquidation`, `crypto_transactions`, `disposal_records`, `divorce_records`, `inheritance_records`, `securities_transactions`, `selective_payment_records`, `spouse_asset_evidence`. **8서류/8행이 독립 양도 8건임을 증명하지 않음**. 매도자·매수자·대상 자산·거래일·등기효력일·통화·실입금·수령자·관계·검토상태를 각각 원문으로 대조할 것.
- 예금잔고확인 `bank_balance_certificate`: #058–060 3개×1슬롯. 명의자/계좌식별자/상태는 **잔액·원화금액·압류해제·법률상 소유 확정 아님**. 잔액/평가기준일은 #061 이후 별도 필드로 재검사 필요.

## 발견·분류 및 미승인 경계
1. **P1 감사 경고 false-negative 지속(기존 Draft PR #22 관련):** `feature-lineage-audit.ts`에서 신규/기존 canonical 행의 법률 gap이 후보위험 개수만으로 사라진다. 실제 등록 조인에서는 **14/20** 미승인 필드의 `LEGAL_RISK_SOURCE_FIELD_NOT_EXPLICITLY_LINKED` 경고가 가려진다. 이것은 **감사 표시 결함의 V8 분기 재현**이며 법률판단·실사건 승인 우회 재현이 아니다. [Draft PR #22](https://github.com/firmengine/firmengine/pull/22)는 미병합, 별도 코드 중복수정 금지. 법률담당자가 관할·시행일·실무서식 및 증거군을 승인하기 전 `0%` 인수.
2. **P2 #050의 간접 계산 증거 누락 주의:** `asset_transfer_disposition::proceeds_received`는 직접 typed=0, 산식 입력 목적지=없음이지만 `MATERIAL_CALCULATION_SOURCES`에 **`context_only`**로 정확 등록돼 있다. 따라서 단순한 "계산 소비 0"·불필요 피처로 처리하지 말 것. 원 입금, 이전 보유재산, 새 보유재산·대상/기간·통화 검산 후보이나 자동 원화 합계·청산가치 산식 입력 아님.
3. **P1/P2 법률판본 귀속 검토:** #042 `ruleset_id`, #043 `submitted_at`, #044 `transition_rule`, #045 `application_date`, #046 `venue`는 관리형 법령 기준·`context.courtId/applicationDate`로 직접 승격되지 않는다. 접수 전 예약일·법원 접수일·진술서 서명일을 혼동하거나 관할 확정으로 오인 금지. 시행일/경과조치·법원별 양식은 법률 담당자 승인 전 `unverified`.
4. **P2 금액 3종 분리:** #048 `consideration`은 계약대가, #049 `market_value`는 시가, #050 `proceeds_received`는 실제 수령액. 세 금액은 **동일 사건의 세 성질**일 수 있다. 미관찰·null·마스킹·명시적 없음·확인된 0·상충·비해당는 서로 별도 기록으로 관리. 8문서와 3금액을 무조건 더하거나 임의 원화 환산 금지.
5. **추가 실증 필요:** 법률위험95/규칙50/예외46의 승인형 정확 `canonicalID×courtId×effectiveDate×subject/period` 증거 계약 **0% 인증**. 갈음·법원보정은 관리형 함수/정책 선언과 실제 사람 승인·보정명령 수신이 다르며 이번 20 ID의 실 적용 0건 관찰. 원천 page/record/quote/bbox/DB Fact·typed 전파 및 18계산의 실측, 공식 서식 Word 바인딩·실제 D1/R2/Cron/전체 CI 모두 **미인증**.

## 체크 ID별 부분 수행([ ] 유지)
| 역할/보드 ID | 실제 관찰 | 미해결 |
|---|---|---|
| 변호사 `A3-LAW-019` | #042–046 판본/경과/접수/법원 구분, 위험95·규칙50·예외46 및 seed 0 확인 | 관할·시행일별 승인/정식 근거·사건 적용 0건 |
| 서류 `A3-DOC-009` | #047–057 8서류×11행 원천 라우트 및 증거/복수행 분리 정책 확인 | 편파변제·증여·명의변경/갈음/법원 보정 실사건·사람검토 없음 |
| 데이터 `A3-DATA-003` | 20 ID/97슬롯, typed0/서식0, #050 context-only·정확 위험0, 정적 160 단언 | D1/R2 원문 재독·subject hash·실제 source-only 상태 검증 없음 |
| AX `A3-AX-019` | 처분대가/시가/실수령·source-only 분리와 법률 경고 후보 14/20 원본 분기 재검사 | 모델 실호출/의미확정·법률 검토 결과 자동승격 미인증 |
| IT `A3-IT-016` | 직접 OCR→서식 0/20, `form-mapping`의 별도 context 날짜 경로 확인 | 실제 공식 법원 토큰/반복행/docx 생성 검증 없음 |

## 검증 수준·다음 시작
- **실제 실행한 것:** V8 계약 정적 조인·160/160 단언, 693개 등록표 번호 정합, 원본 `hasPeriod/hasUnit` 식 40회, 법률 gap 원본 삼항식 추출 20회(14개 위험 후보 경고 제거 관찰).
- **실행하지 않은 것:** 기존 `node --test` 및 전체 Node/CI, 고객 OCR, CaseData/D1/R2/Cron/공식 양식/변호사 검토/사이트 배포. 원본 앱 함수/운영 사례를 실행했다고 표현하지 말 것.
- **후속:** canonical **#061 `bank_account_balance::balance` → #080** 다시 최신 SHA에서 조회. 이전 **Draft PR #22/#51/#99**과 동일 파일 병합 충돌/별도 기능 검토 후에만 코드 수정. 역할 시작 **계산사무장**. 최종 제품 인수 완료 **0**.
