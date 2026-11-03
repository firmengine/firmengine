# FirmEngine A2 r96 — 변호사: PV 잠정승격·서울 424호 관할 및 경과규정 독립 감사

작성: **2026-11-03 12:12 KST** | 회차 역할: **변호사** (직전 r95b 계산사무장 → 다음 데이터담당자) | 인수: **0건 / 보드 [ ] 유지**

> 범위 `firmengine/firmengine/main`의 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부. 공개 실고객 자료·OCR·개인정보·키·.env·비공개 정답 미사용. 원문 Fact 법적 인정/법원 인가는 자동 추론하지 않음. 운영배포, 운영 D1, 전자제출·법원 인가 실행 금지.

## 1. 시작판본·선행 회차·소스
- 조회 시 main HEAD: `3b423ad75479e1aaf768e0c37721a918cf35ebe6`, 보드 blob `deeef9f4de1cae560677d7dbdbaed73abe42e03d`. 선행 `r95b` 영수증: `docs/release-audit-runs/A2/2026-11-03_r95b_calc-pv-and-provisional-gate-independent.md`; 계산사무장 A2-CALC-027/028 [ ].
- main `lib/assessment.ts` blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`의 `calculateCase` 청산 비교/trace, `assessCase` 개별 `finding(liquidation)` 및 `generationGate`를 재독. `lib/seoul424-candidate.ts` blob `fb4f7f09e37e957481996304fbe4916764c8d7da` 재독.
- main `lib/case-execution.ts`의 provisional 원장 차단 부재, `lib/office-writer.ts`의 최종 양식 게이트 및 `lib/approval-readiness.ts`의 사전 작업목록/법원결정 `not_inferred` 구분 재독. `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`; `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`.
- 열린 Draft: [#18](https://github.com/firmengine/firmengine/pull/18) (서울 관할 null), [#84](https://github.com/firmengine/firmengine/pull/84) (미승인 PV 비교), [#215](https://github.com/firmengine/firmengine/pull/215) (provisional 원장 최종 차단). 모두 **미병합·실무자 인수 전**. #194/#203 등 세금/원장 구조 Draft도 별도 미통합.

## 2. 실제 수행한 테스트 — A2-LAW-022/023, PV 승인 경계
- GitHub main `const liquidationComparison = ...` 한 줄과 Draft #84 `const liquidationReviewReady = ...`, 비교식 변경부분을 직접 추출하여 V8 독립 fixture에서 실행. 변경한 것은 TypeScript 타입 문법뿐; **실제 `calculateCase()` 전체 실행이 아님**.
- 11개 합성조건 × 36/48/60개월 배경값 = **33개 격리 조건**, 독립 사전 기대와 일치한 수 **main 18/33, Draft #84 후보 33/33**, 예외 0. 기간 변경은 이 비교식 자체에 영향을 주지 않음(36/48/60개월 배분·PV 할인 계산이라고 주장하지 않음).

| SYN 입력 / 상태 | 독립 기대값 | main 관찰 | Draft #84 식 관찰 |
|---|---|---|---|
| PV=150원, 청산=100원, 두 검토=true, 재산 accepted | met(수치만) | met | met |
| PV=90원, 청산=100원, 두 검토=true | not_met(수치만) | not_met | not_met |
| PV=150원, 청산=100원, PV 검토=false | unknown | **met** | unknown |
| 같은 금액, 재산 평가기준 검토=false | unknown | **met** | unknown |
| 같은 금액, 두 검토=false | unknown | **met** | unknown |
| 같은 금액, 자산 recognition=unreviewed | unknown | **met** | unknown |
| 같은 금액, 계산 자산행 reasons=[SYN_ASSET_UNRESOLVED] | unknown | **met** | unknown |
| 같은 금액, 재산 평가일 상충 issue 존재 | unknown | unknown | unknown |
| **명시적 0원 / 0원**, 모두 검토 | met(수치비교) | met | met |
| PV=null, 청산=100원 | unknown | unknown | unknown |
| PV=150원, 청산=null | unknown | unknown | unknown |

- 특히 **미승인 5종 × 3기간 = 15건**이 main에서 `met`로 표시. `assessCase`는 `liquidationComparison === "met"`만으로 **개별 liquidation finding을 pass**로 기록하는 것을 원문 재독. **단, 다른 `present_value_review`, `asset_valuation_basis`, 잠정 trace finding이 생성되고 `generationGate.canFinalize`이 별도 판단하므로 실제 최종 제출 통과는 확인하지 않았음**. 이것은 항목별 상태 표현 오류, 법원 인가 사실 아님.
- #84 기존 Draft에 미승인 `unknown` guard와 테스트가 작성되어 있음. 이번 회차 **제품 코드 수정·합병 없음**, #84 기존 Draft 그대로 HOLD(다른 assessment.ts Draft와 병합 충돌 위험).

## 3. 실제 수행한 테스트 — A2-LAW-019/021, 서울회생법원 제424호
- main `evaluateSeoul424()`의 실제 함수 본문에서 TypeScript 표기만 제거, 판본 인자 `seoul` / `2026-10-01` 및 외부 근거 함수는 고정 **합성 stub** 사용하여 V8 격리 실행. 별도 결함 격리 후보는 기존 Draft #18의 `courtId=null` 차단 조건 동형.
- **8개 합성조건, main 독립기대 6/8, 관할 unknown 차단 후보 8/8, 예외 0**. 서울 첫 접수 2026-10-01 + 7호 증빙요건 sourceValidated/legallyRecognized=yes ⇒ `candidate_for_human_review` (법률승인 아님). 다른 관할(bus-an) ⇒ `not_applicable`, 최초 접수 2026-09-30 ⇒ `unsupported_version`, 접수일 null/invalid 및 부채 증빙 null ⇒ `unknown`.
- **반례 2건:** 관할 `null`이면서 ① 7호 누적요건이 긍정 또는 ② 1~6호 항목이 긍정인 경우 **현재 main `candidate_for_human_review`**, 독립 기대는 `unknown`. 기존 Draft #18은 이를 보완하지만 **미병합·실제 케이스별 관할증빙 미인증**. 원천사실 보존, 자동 법적 적용 변경 금지.

## 4. 공식 원문: 관할·개정·시행·경과
- **서울회생법원**, 실무준칙 [제424호 개정전문](https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf?v=2), 2026-09-23 개정. PDF 표시 252–253쪽(원본 PDF 0-index 271–272)에서 제2조 제2항 제7호 **4개 누적조건**: ① 최근 2년 최저임금 미만 급여, ② 총채무 5,000만원 이하, ③ 개인채권자 없음, ④ 최근 1년 채무 없음(물품구입 신용카드채무 예외) 확인. [법원 공지 2026-10-01](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187).
- **기존 영수증의 미확인 부분 보완:** 같은 개정전문 **부칙**(PDF 0-index 391, 표시 372쪽)에서 **2026-10-01 시행, 시행일 이후 최초 접수 사건 적용, 시행 전 이미 인가된 변제계획 보호 경과조치**를 공식 페이지 이미지로 확인. 그러나 개별 사건의 최초 접수·관할·시행일 귀속을 데이터에서 판단하지 않았으며, 변호사 확인 전 규칙 자동 승격 금지.
- **국가법령정보센터**, `채무자 회생 및 파산에 관한 법률` [제611조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777), [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759): **법률 제21490호, 2026-10-02 시행**. 3년 원칙/특별사정 5년, 인가결정 시점 현재가치·청산배당 등은 법률상 검토. **서울 준칙 2026-10-01 시행일과 법 2026-10-02 시행일은 다름**.
- **국세청**, [VAT 과세기간 공식 안내](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2272): 일반과세자 통상 반기·간이과세자 통상 연간. VAT·종소세 수치를 법적 인정 월순소득으로 자동 합산하지 않음.

## 5. 정적 계약 / 미실행 구분
- 실제 JSON **정적 재파싱**: 계산 18모듈, 입력 선언 91(고유 78), 출력 선언 42(고유 40), resultPaths 42; 토큰 D5103=37, D5106=48, D5110=55, D5111=82. 출력 토큰 수는 실제 DOCX 렌더/재독 성공을 뜻하지 않음.
- 독립 예시 산술: 900,000원 × 36/48/60 = 32,400,000/43,200,000/54,000,000원(할인 전 명목). 실제 18모듈 런, 원문→Fact→typed→SQL 저장·재독→서식 재독, 전체 Node/CI, staging D1/R2/Cron, 공식 법원 서식 동등성, 법률/계산사무장 최종 승인 **전부 미관찰·미인증**.
- source-only, 승인전, 법적 부적격, 미관찰 null, 명시적 0, 비해당, 상충을 혼합하지 않음. `candidate_for_human_review`, 수치 `met`, 법원 인가·변호사 승인 상태는 상호 동의어가 아님.

## 6. A2 ID · 조치 · 다음 역할
- `A2-LAW-019`: 서울관할 null 후보승격 main 반례 재검증 2건, [ ] 유지.
- `A2-LAW-021`: 제424호 **부칙 시행/최초 접수 적용** 공식 PDF 이미지 확인, 법 2026-10-02 시행과 분리, [ ] 유지.
- `A2-LAW-022`: 현재가치 승인전 `liquidationComparison=met` main 15/33 반례, #84 33/33 후보, [ ] 유지.
- `A2-LAW-023`: 개별 finding pass≠전체 생성허가≠실무자 승인≠법원 인가, [ ] 유지.
- **제품 변경 없음**. 기존 #18·#84·#215는 실제 Node/TS·합본 충돌, 동일 사건 원천/계산 버전, D5110/11 DOCX·법원 공식 서식·실무자 검토 전 병합 금지. 다음은 **데이터담당자**가 Fact 증빙의 최초 접수일·관할·청산/PV 금액 판본·SQL 원장 소유 일치성을 검증.

**인수 합격 0건. 법원 규칙/수치의 자동 법적 인정 금지.**
