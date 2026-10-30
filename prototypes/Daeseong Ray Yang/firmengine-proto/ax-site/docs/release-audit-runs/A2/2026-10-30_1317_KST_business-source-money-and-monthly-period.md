# A2 1차 회차 — OCR 원문·정규화 사업금액 무결성과 월별/세무·서울 실무준칙

- 2026-10-30 KST 13:17 시작, 최신 감사 기준 `main=0385beda614b3814d93e25f7625c573c4d7890d3`.
- 코드 수정 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만.
- 기존 동시 작업: A1 별도 draft PR #12 검토 중. A2는 독립 브랜치에서 최소 변경하여 덮어쓰지 않음.
- 이번 검토 A2-IT-004(결측·0), A2-DATA-005(OCR 원문·Fact·typed 대조), A2-CALC-005(VAT 공급가액·세액 구분), A2-CALC-016(12개월 대표기간 누락), A2-LAW-015(서울 제424호 개정). 인수 완료 `RELEASE_READY`인 항목은 **0개**.

## 1. 재현된 결함 — 금액이 바뀌어도 직원 검수용 증빙에서 '검증됨'으로 표시

**관련 ID: A2-DATA-005, A2-IT-004**. 최초 소스:
- `lib/business-source-evidence.ts` SHA `0b796d9c3bc608c1224c5f9a049c80b6951a8b74`.
- `lib/domain.ts`의 `Fact.value/rawValue/numeric` 및 `FieldObservation.sourceState` 계약.
- 법적 순소득 승인 전 read-only `auditBusinessSourceEvidence()`가 `moneyValue(fact.numeric)`만 검증하여 원문과 값이 충돌해도 `verifiedAndAcceptedSource=true`를 출력.

**격리 합성 사례 (독립 기대와 실제 비교)**: 2026-01 경비 원문 행 `Fact.value=1200000`, `Fact.rawValue=1200000`, KRW, 기타 신뢰/원본 참조 필드 검증 정상, 다만 `numeric.rawValue/amountWon=700000`을 삽입.
- 독립 기대: 금액 표시 `null`, 검증 `false`, 직원에게 원문-정규화 불일치로 보류.
- 수정 전 실제: `amountWon="700000"`, `verifiedAndAcceptedSource=true` (**결함 실제 재현**).
- 추가 반례: `Fact.rawValue=900000` (기존 typed `1200000`)도 실제 검증=true, `fieldObservation.sourceState=explicit_none`인데 금액이 존재해도 실제 검증=true.
- 동일한 원문/typed/관찰상태가 온전한 `1200000`은 정상 검증.

**수정**: 해당 조회 함수에 원문 `Fact.value === Fact.rawValue === NumericInput.rawValue`, 단위 `sourceUnit===numeric.unit`, sourceState가 있을 경우 `present` 검사와 금액 정규화 확인을 결합. 상충/명시적 없음은 `amountWon=null`, `verifiedAndAcceptedSource=false`로 내려 담당자 월별 원천 차액 프리뷰를 중단. 원본 데이터는 절대로 변경하지 않음.

**실행 증빙 레벨: `SYNTHETIC_EXECUTED(격리 원본함수 body)`**:
- GitHub에서 읽은 **실제 함수 본문**을 Code Mode V8에서 타입 주석만 제거해 호출. 외부 출처검증 의존성은 합성 고정 스텁; Node 전체 프로젝트와 DB가 아니다.
- 원문·typed 동일 1건, 정규화 stale 1건, raw stale 1건, sourceState explicit_none 1건. **수정 전 기대 일치 1/4, 수정 후 4/4**.
- 회귀 Node 테스트 소스: `tests/business-source-evidence.test.ts`에 동일 4개 조건 추가. 실제 `node --test` **미실행**.
- **Draft PR #13** https://github.com/firmengine/firmengine/pull/13; 분리 브랜치 `audit/a2-business-source-money-integrity-20261030-1317`, 수정 SHA `46057d478656d0a20782761fa9deac6dcda95859`, 테스트 SHA `c77782b8fad882ae17a9df97c57a510aa888de87`. main에는 병합하지 않음.
- **주의**: 과거 사건 중 rawValue 없는 레거시 Fact는 이제 미검증으로 보일 수 있다. 실제 구판본 역호환·Node 타입/전체 회귀·staging D1/R2를 검증하기 전 병합 금지.

## 2. 월별 원문/세무 성격 합성 감사

**관련 ID: A2-CALC-005, A2-CALC-016, A2-IT-004**.
- `lib/business-monthly-workbench.ts` SHA `0174f228473516e94664be445d8f46a33f833f80`.
- GitHub 실제 순수함수 `assembleBusinessMonthEvidence()`에서 TypeScript 타입 주석만 제거해 합성 `BusinessSourceMoneyRow[]` 입력을 제공. 최초 격리 하네스가 non-null assertion 제거 과정에서 `!==`를 `==`로 잘못 치환하여 기대 실패했으나 **정규식 수정 후 새로 실행했고 최종 다섯 결과만 아래 공식 증거로 채택**. 소스 버그로 잘못 보고하지 않음.
- **5/5 독립 기대 일치(격리 V8, Node/DB 아님):**

| 독립 합성 입력 | 기대 결과 | 실제 관찰 |
|---|---|---|
| 12개월 각 월 매출 3,000,000, 경비 1,000,000, VAT·경비 서로 다른 원문행 | 각 월 원천 총계는 보이되 동일 사업자 승인 부재로 법률상 순소득/검토용 차액 `null` | 12 슬롯, 매출/경비 각 총계 정확, 차액 `null`, coverage incomplete |
| 11개월만 제출, 12월 누락 | 마지막 달 금액 `null`, `BUSINESS_MONTH_NO_SOURCE_ROWS` | 일치 |
| 과세 매출 구성요소/매출 VAT/매입 VAT만 존재 | 부가세/매출부분합을 순소득/총매출로 합산하지 않음 | 매출총계/경비총계/차액 모두 `null` |
| 원본에서 실제 매출·경비가 각 0원, 그러나 별개 서류 | 원천 금액 `"0"` 보존, 인정/조합 없으므로 차액 `null` | 일치 |
| 원천 금액 null 및 미검증 | 금액 `null`, `BUSINESS_SOURCE_VALUE_UNVERIFIED` | 일치 |

- 국세청 공식 「부가가치세 개요」에서 부가세는 **매출세액−매입세액** 계산, 사업 순소득과 구분. 일반/간이/면세 유형과 과세기간이 다르므로 `business_costs_and_ledgers::income.business_cost.tax_component`(`input_vat`)를 비용 인정액·매출 VAT로 자동 치환하는 로직은 금지. 참고: https://sc.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2272 (2026-10-30 조회).
- 인정 순소득 `사업 매출−법적으로 인정된 필요경비` 등의 구체적 비용 인정 기준은 세무사/사무장/변호사와 승인형 기준정보로 별도 검토해야 함. 월별 증빙 차액을 세법상 소득액·법원 변제재원으로 동일시하지 않음.

## 3. 서울회생법원 424호 / 법령 최신판 실제 원문 대조

**관련 ID: A2-LAW-015**.
- 서울회생법원 공식 「실무준칙」 PDF https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf?v=2 의 **PDF 272~273쪽(0-base P271~272; 본문 쪽수 252~253)**을 실제 페이지 이미지로 확인.
- 제424호 표지 **2026-09-23 개정**. 제2조 제2항 제7호 신설의 네 조건 **모두**: 최근 2년 최저임금 미만 급여; 채무 총액 5,000만원 이하; 개인채권자 없음; 최근 1년 발생 채무 없음(물품 구입 신용카드채무 제외). 제2조 제3항의 법원 재량·인가심사는 남아 있음. 시행일/최초 접수일 조건은 별도 공고 및 담당 변호사 최종 확인 필요.
- `lib/reference-parameters.json`의 `param.seoul.shortened_term.effective_from=2026-10-01`, debt max `50000000`, wage period 2, recent debt 1, 서울 관할만. `lib/seoul424-candidate.ts`는 모든 제7호 조건을 human-reviewed evidence로 확인할 때도 결과 `candidate_for_human_review`만 반환하고 인가를 자동 판정하지 않는다. **코드 정적 확인 + 공식 PDF 일치**, 실제 사건 통합·법률 승인 미인증.
- 국가법령정보센터 채무자회생법 **[시행 2026-10-02] [법률 제21490호, 2026-03-24 타법개정]** 확인: https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0001&lsiSeq=290631&urlMode=lsScJoRltInfoR. 사건 접수일이 이전이면 다른 판본 검토 필요.

## 4. 완료·미완료 및 다음 교대

- **이번 회차 5개 ID를 부분 검토**. 값/법적 완결·운영 인수에 해당하는 체크박스는 전부 [ ] 유지. 수정 후보 별도 Draft PR #13 생성. 메인 소스는 변경하지 않음.
- **미인증**: Node22+ 전체/해당 테스트 실행, TypeScript/lint/build, ORM+D1 실제 DB insert/reload, 18 계산모듈 전수 91입력, 최종 D5103/D5110 문서 값·Word/PDF, 실제 개인정보·OCR, 운영 D1/R2/Cron, 변호사/세무 담당 최종 승인.
- **다음 A2 검토**: A2-DOC-004(수입·지출 목록의 공식 서식 토큰과 source), A2-AX-004(0/NA/unknown 프롬프트-typed 처리), A2-IT-015(DB round-trip), A2-CALC-006(VAT 세액 차감 금지), A2-LAW-016(424호 복수 조건·접수일 경계).
- **주의**: PR #12(A1)와 같은 원본 파일·검수 상태를 건드리지 않았고 합의 없는 source 변형/배포는 실행하지 않음.
