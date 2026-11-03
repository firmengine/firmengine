# FirmEngine A2 r97 — 데이터담당자: 최초접수일/관할 근거·청산 PV 소스계보 독립감사

작성: **2026-11-03 13:15 KST** | 역할: **데이터담당자** (직전 r96 변호사 → 다음 AX담당자). **최종 인수 0건**, 변경 허용범위 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 한정.

## 1. 시작 기준·코드·영수증
- 본회차 GitHub main 시작 확인 SHA `013684aa31447ebfba65a7d8e96b62b5a3893dc2`, 기록 직전 HEAD `013684aa31447ebfba65a7d8e96b62b5a3893dc2`. 메인 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`의 **A2-DATA-005 / 015 / 018 / 020** 미완료 체크 참고. 직전 [r96](2026-11-03_r96_1212KST_law-pv-seoul424-review-gates.md) 재독.
- 실제 main 소스 blob: `lib/seoul424-candidate.ts` `fb4f7f09e37e957481996304fbe4916764c8d7da`; `lib/legal-proposals.ts` `abeb66cc4d90ded3942eb07edc6fae2f9f1dc73c`; `lib/domain.ts` `39ab41856f6d7a379aca7217d24b28f7f5f7616a`; `lib/assessment.ts` `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`; `lib/case-feature-snapshot.ts` `f0bc820fb10a591d9f374aae23bffcbb9625d682`; `lib/case-calculation-feature-store.ts` `bb5f88b26e68f5ae2234741063ac9301a927e27a`; `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`.
- 기존 Draft #18(서울 관할 null), #84(미승인 PV), #205/#207(Fact·subject 무결성), #209(계산 run 판본) 목록·상태 재조회. 관련 테스트 `tests/legal-proposals.test.ts`, `tests/calculation-18-output-golden.test.ts` 코드 재독. **전체 Node runner·PR 통합검증은 실행하지 않음.**

## 2. P1 후보: 최초 접수 원천과 사건일자 프록시가 미분리
- 실제 `legal-proposals.ts`는 `const appDate = data.context.applicationDate;`를 읽고 `evaluateSeoul424({ courtId: data.context.courtId || null, firstFilingDate: appDate || null, ... })`로 전달한다. **개별 최초접수일 증빙 Fact ID/출처/승인상태를 이 연결 함수에 함께 전달하지 않음**. `seoul424-candidate.ts`의 `court_scope`, `effective_date` 조건도 `factIds: []`. `domain.ts`의 합성 사건 생성 기본값은 `applicationDate=asOf`, `courtId="seoul"`. 이 입력값이 실제 최초접수 서류에서 확인됐다는 뜻은 아님.
- 합성 반례: 화면/컨텍스트 applicationDate=`2026-10-03`와 courtId=`seoul`이며 제424호 7호 증빙을 모두 양성으로 놓더라도, **실제 최초 접수일 Fact 미관찰**이면 독립 데이터인수 기대는 `unknown / human-review`. 하지만 위 caller만으로 2026-10-03이 `firstFilingDate`로 전달되어 `candidate_for_human_review`가 가능하다. 이는 **후보 표시 단계의 증빙계보 위험**이지 법원의 인가나 사용자 데이터 유출을 입증한 것이 아님. 실제 최초 접수일이 다르다는 운영 사례 확인도 수행하지 않음.
- 별도 법률/데이터 설계 필요: `context.applicationDate`를 최초접수일의 자동 사실 증명으로 취급 금지. 별도 최초접수 확인값·문서참조·reviewer·관할증빙·사건판본 계약을 담당자 승인으로 결정해야 함. 무승인 자동규칙 변경 금지.

## 3. 실제 V8 격리시험 — 입력 / 독립 기대 / 관찰
`seoul424-candidate.ts`의 `validDate/wageCriterion/evidenceTri/evaluateSeoul424` **원본문**에서 TypeScript 타입 표기만 제거하고, 외부 `referenceParameter*`는 서울/2026-10-01/5천만원/2년/1년/공식 URL의 독립 합성 값으로 stub하여 V8 `new Function` 실행. 해당 함수 전체 호출이나 외부 DB/API가 아님.
- 10조건 중 **9 기대일치, 1 불일치**. 독립적으로 설정한 데이터 인수 기대:
  1) 서울+2026-10-02+근거검토 4요건 모두 적격 → `candidate_for_human_review` (실측 일치, 법적 인정 아님).
  2) 2026-09-30 최초접수 → `unsupported_version` (일치).
  3) 최초접수 null, 달력오류 2026-02-30 → 각각 `unknown` (2건 일치).
  4) 부산 관할 → `not_applicable` (일치).
  5) **관할 null, 다른 4조건 긍정 → 기대 `unknown`, 실측 `candidate_for_human_review`** (기존 #18 결함 재현). `court_scope=unknown` 상태를 보존했지만 최상위 status만 후보로 승격.
  6) 채무근거 sourceValidated=false / 채권자 법률인정=false / 최근채무 Fact ID=[] → 각각 `unknown` (3건 일치).
  7) 검증된 개인채권자 존재 → `not_candidate_on_known_facts` (일치).
- `case-feature-snapshot.ts` `sourceReadingMatches(raw,fact)` 실제 본문(타입만 제거)+독립 deep-equality stub: **8/8 관찰 재현**. 합치 Fact, null≠0, 명시적0=0, 대상자불일치, 원문 sourceHash 불일치, retracted 및 rejected의 **금액일치 자체**를 구분. 특히 retracted/rejected도 이 **단순 일치 helper에서는 true**; 별도 `currentFacts`/리뷰 검증이 수행되어야 함. 이 8건은 소스 값 비교이지 원문→Fact→typed→SQL 종단 실행 또는 법률 인가 검증 아님.
- `assessment.ts` 실제 `const liquidationComparison = ...` 표현식을 평가: **독립 기대 4/5 일치**. PV=150원·청산=100원·PV 승인=false에서 **기대 `unknown`, 실측 `met`**. 승인이 true이면 `met`; 90<100이면 `not_met`; PV null이면 `unknown`; 명시0/0이면 `met`. 동일 코드의 현재가치 trace에는 `factIds: []` 존재. 이 trace의 빈 근거 배열은 승인 사실의 존재증명이 아니며 실제 승인상태/근거 SHA 확인 전 `met`를 법률상 확정값으로 승격 금지. 기존 Draft #84 미병합.
- 전체 기대 일치 건수: **21/23**(서울 9/10, 원문/Fact 일치 8/8, PV 4/5). 실제 제품 전체 계산·SQL·DOCX 실행 성공률이 아님.

## 4. 산식·서식/저장 정적 대조
- 실제 JSON 직접 파싱: 계산 **18모듈**, 입력선언 **91(고유 78)**, 출력선언 **42(고유 40)**. template-token-catalog: **D5103 37, D5106 48, D5110 55, D5111 82** 토큰. 이는 명세 수량 확인이지 각 토큰의 최종 바이트·DB 원장 데이터 대조가 아님.
- 독립 BigInt **명목합산**: 월 900,000원 × 36/48/60개월 = **32,400,000 / 43,200,000 / 54,000,000원**. 할인현재가치(PV) 산식·법률승인액 아님. 원문→Fact→typed→SQL feature 출력 42경로→DOCX 생성 및 재독은 **미실행**.
- 상태구분: 관측된 0은 관측되지 않은 null이 아니며, `unknown`/미적용/원문 source-only/상충/승인전/법원인가를 별도로 유지.

## 5. 공식 법률·국세청 근거(법원/시행일 독립 기록)
- 서울회생법원 공식 [실무준칙 개정전문](https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf?v=2) PDF **인쇄 252·253쪽(0-index 271·272)와 부칙 인쇄 372쪽(0-index 391)을 이미지로 직접 확인**. 제424호 2026-09-23 개정, 제2조제2항제7호 누적조건: 2년 최저임금 미만 급여/채무 총액 5,000만 이하/개인채권자 없음/최근 1년 채무 없음(물품구입 신용카드채무 예외). 부칙: **2026-10-01 시행**, 시행 후 **최초 접수 사건 적용**, 시행 전 이미 인가된 변제계획의 효력에 영향 주지 않음. 신규 조건의 자동 적용 금지.
- 국가법령정보센터 [채무자회생법 제611조](https://www.law.go.kr/법령/채무자회생및파산에관한법률/제611조)·[제614조](https://www.law.go.kr/법령/채무자회생및파산에관한법률/제614조), 법률 제21490호 **2026-10-02 시행판** 확인. 서울 준칙 10-01과 법률 10-02는 **서로 다른 날짜**이며 사건별 적용/승인은 변호사 검토 전 미인증.
- 국세청 [부가가치세 개요](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2272) 및 [2026-01-08 공식 신고 보도자료](https://b.nts.go.kr/bukbusan/na/ntt/selectNttInfo.do?mi=5136&nttSn=1347790). 일반과세자는 통상 반기, 간이과세자는 연간 과세기간. VAT·종합소득세 신고값을 월별 법원 인정 소득으로 자동 승격하지 않음.

## 6. ID별 관찰·조치·다음
- **A2-DATA-005 [ ]**: 원문 ↔ Fact 금액·출처 8/8 격리대조. retracted/rejected의 값 일치는 인정 여부와 별개; OCR/typed/SQL 종단 미실행.
- **A2-DATA-015 [ ]**: 기준적용 출처와 최초접수일의 **Fact+reviewer+case revision** 계약 미구현 가능성. `applicationDate`의 `firstFilingDate` 프록시 위험 관찰; 공식 준칙 부칙 대조.
- **A2-DATA-018 [ ]**: PV trace의 `factIds=[]` 및 수치 `met`가 근거/법률 승인 증빙이 아님; D5103/5110/5111 정적 토큰만 재확인.
- **A2-DATA-020 [ ]**: 관할 null에서 최상위 candidate 오승격 1건, PV 미승인 `met` 1건; null/0/미관찰/법률 승인 전 분리.
- **제품 계산·세법·법원서식 규칙 변경 0건.** 고위험 후보 수정은 기존 Draft #18/#84를 유지하고, 최초 접수일 근거 모델은 별도 설계·변호사 실무검토 전 자동 변경하지 않음. 다음 **AX담당자**가 직접 run/법률전용 기준 SHA/최초접수 증빙과 서식토큰 적용·계산 소유/판본 및 #18·#84 Draft 통합 Node/CI 충돌을 검증.

## 7. 인수 게이트(미관찰)
- 프로젝트 전체 Node runner/CI, production/staging D1·R2/Cron, SQL 42출력 실제 저장 재독, 공식 DOCX 생성·재독, 법원 공식서식 일치, 계산사무장·변호사 승인: **모두 미실행/미인증**.
- 운영배포/운영 DB 마이그레이션/실제 전자제출/법원 인가확정 **수행 안 함**.
