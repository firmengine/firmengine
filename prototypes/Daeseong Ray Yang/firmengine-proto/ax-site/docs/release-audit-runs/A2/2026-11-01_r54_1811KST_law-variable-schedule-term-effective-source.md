# FirmEngine A2 54차 — 변호사 검토: 변제원장 변동월액, 제611조/614조 적용, 제424호 효력 경계

- 회차 관찰 시각: **2026-11-01 18:11 KST**, 시작 관찰 main `c0f27c494b3905086247a0656c1eaaeeaf45760c`; 최근 main 커밋 `c0f27c49` docs(A1): merge round 54 checks into three board IDs only / `9f7c4caf` docs(A1): record round 54 role, draft handoff and ledger V8 checks / `3e69baca` docs(A4): link r53 null poll deadline receipt to four open checks / `f2ecc217` docs(A4): record r53 null poll deadline starvation and safe read-only diagnosis.
- 허용 작업 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 안만. 단일 인수 기준 보드 blob `c7d4d0ad27d774311872e80f8868019fcc59b763`. 본 영수증은 A2 54차 전용이며 동시 작업자 파일을 변경하지 않는다.
- A2 53차 계산사무장 → **54차 변호사** → 다음 55차 데이터담당자. 대상 보드 ID **A2-LAW-014, A2-LAW-015, A2-LAW-018, A2-LAW-022**; 4건 모두 **[ ] 부분 검증·실무 최종 미인증**.
- 선행 영수증: `docs/release-audit-runs/A2/2026-11-01_r53_calc-default-month-frontload-review-gate.md`. 선행 Draft **#133** (default 월별 잔여원 초과 감시), **#25** (단계 분할 월말일), **#29** (채권잔액 미확정), **#43** (원장 오류 형식), **#130** (D5103/D5110/D5111 내부 사전검증) PR 존재/미병합·Draft 확인. 실제 GitHub 파일과 스키마, 테스트 소스 독해 완료.
- 원본 blob main: `lib/repayment-plan-model.ts` `6b9e53caba3be1eab17373956aa19717cfeec980`, Draft #133 동일 파일 `59cda151563d63ff2eb1187102f668829872e9b7`; `lib/plan-reconciliation.ts` `1c895fd2fd8a133368315532ed2ab9984d64b2e3`; `lib/assessment.ts` `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`; `lib/context-validation.ts` `7ea7262cca177cc92a59f65fe917cc14573786db`; `lib/reference-parameters.json` `e57a9d7c99efe052d4581d780ed478d876eb3330`. 본 회차 main 코드 변경/PR 병합 없음.

## 1. 직접 실행: 실제 함수 본문의 변동월액·원칙/예외기간 경계 (가상 데이터)

- GitHub의 실제 main/Draft #133 `lib/repayment-plan-model.ts` TypeScript 본문을 각각 읽고 import, 타입 표기, non-null `!`만 제거하여 V8 `new Function`으로 실행했다. `moneyValue`에 한해 synthetic typed-money `{rawValue, amountWon, unit:"KRW",currency:"KRW", normalizationStatus:"exact"}` 입력에 대응하는 격리 스텁 사용. 정식 프로젝트 Node/Cloudflare 실행은 **아님**.
- 공통 synthetic: `context.planMonths=N, paymentSchedule=null, monthlyTrusteeFee=typed("0"), revision=1`; 채권 ID `D1`, 원금 `typed("10000")`, 이자 `typed("10000")`, 분류 ordinary, Fact `["SYN-F1"]`; 계산 `caseRevision=1`, Fact `["SYN-F1"]`, 해당 allocation만 조절. 원문/OCR 사실값이 아니라 **가상 인풋**.
- **36개월** 원금배분37/이자35/제안월액2원 => 독립 월별: 첫회 3원, 마지막 1원, 전체 **72원**. main `provisional/issues=[]`, Draft #133 `blocked/DEFAULT_ORDINARY_MONTHLY_PROPOSAL_EXCEEDED:1`. **48개월** 49/47/2원 => 첫 3원·끝 1원·합 **96원**, same. **60개월** 61/59/2원 => 첫 3원·끝 1원·합 **120원**, same.
- 같은 36/48/60개월 각각 **균등** 원금 N/이자 N/월2원 => Draft `provisional`, 각월2원·총 2N, 초과 없음. **명시적 0원** 원금0/이자0/월제안 문자열 `"0"` => 각월0, `provisional`, 0원 보존. **미관찰 null 제안** 원금 N/이자0/월제안 `null` => 실제 매월1원, `provisional`(금액 승인으로 승격하지 않음; 하위 누락 검토 필요). **비정상 제안 `"9,00"`** => Draft `blocked/DEFAULT_ORDINARY_MONTHLY_PROPOSAL_INVALID`, main `provisional`. 각 기간×5조건 **15/15개** 독립 기대/실제 일치.
- **수동 2단계 변동변제** 36/48/60개월 각각 `paymentSchedule.reviewed=true`, P1(1회: 2026-01-31, 가용3원/납부3원), P2(2~N회: 2026-02-28, 가용2원/회당 2원), `expectedInstallments=N`. 독립 기대: 총액 `3+2×(N-1)`, 1회 3원·2회2원, default-only 검사가 수동계획을 차단하지 않을 것. main/#133 모두 `status=complete, issues=[]`, 1회 3원·2회2원; **3/3개 기대 일치**, 총 **18/18** V8 기대 일치. 여기서 `complete`는 원장 상태일 뿐 **인가·법률상 승인·실제 제출가능**이 아니다.
- **별도 P1 재확인**: 이 수동 일정은 3회차 지급일이 `2026-03-28`로 관찰되었다. 1월31일 원래 월말 앵커의 3월31일 복원과 불일치 가능. 이전 **Draft PR #25**에 이미 해당 수정 후보가 있어 중복 고치지 않았다. 분리된 정상 2월28일 약정이라면 3월28일 자체가 가능하므로, **원약정의 월말 앵커 의미/법적 승인** 확인 전 자동 수정 금지.
- **직접 모델 함수에만** 0/61/72개월을 넣었을 때: 0은 `DEFAULT_PLAN_INPUTS_MISSING/blocked`, 61/72는 `provisional/issues=[]`. **제품 전체 61/72개월을 허용한다는 뜻이 아님**. 실코드 `context-validation.ts`의 `maximumPlanMonths()`는 상한 60을 검증하고 `assessment.ts`의 `plan_term`도 60개월 초과 `fail`, 36개월 초과에는 `exceptionalTermReviewed=true` 없으면 `review_required`. 본 함수 단독의 국소 판단과 전체 앱 법적 상태는 분리한다.

## 2. 계산·저장·서식 계약 및 SQL 합성 재조회

- 현재 main `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` 실제 JSON 파싱: **18 계산모듈, 입력선언 91(고유78), 출력선언42(고유40), resultPaths42(고유42)**. `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: **D5103 37, D5110 55, D5111 82** 등록 토큰. 실행계약 전체/실제 DOCX 토큰치환 합격 아님.
- `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa` DDL을 Python `sqlite3 :memory:`에서 구동, `cases`는 FK를 위한 **synthetic stub**. `case_calculation_runs` 1건 및 `case_calculation_features` 6건 저장·SELECT 재조회 성공:
  - `proposed_monthly`: JSON 2, value_won 2, `provisional`, Fact `["SYN-FACT1"]`
  - `month1_actual`: JSON 3, value_won 3, `provisional`
  - `observed_zero`: JSON 0/value_won 0, `provisional`
  - `unobserved`: JSON `null`, value_won SQL `NULL`, `unknown`
  - **상충** `conflict_json_null_sql_zero`: JSON `null`, value_won 0, `computed` **DDL 저장허용**
  - **부정합** `malformed_fact_array`: `source_fact_ids_json="NOT_JSON"` **DDL 저장허용**
  - 존재하지 않는 run FK는 거부. **실제 D1, 앱 save/replay, 운영 의미검증 미실행**. 0/null/source-only/승인전은 별도 상태 유지해야 한다.

## 3. 공식 법률·법원·국세청 출처 / 적용 경계

1. 국가법령정보센터 **채무자 회생 및 파산에 관한 법률 제611조**, **[시행 2026-10-02, 법률 제21490호, 2026-03-24 타법개정]**: https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777 . 제611조⑤ 변제개시일부터 **3년 초과 원칙 금지 / 특별사정 시 최대 5년 범위**이며 36개월이 무조건 최소기간이라는 뜻이 아님; 제611조③ 같은 조 채권의 평등 취급 등도 검토 필요.
2. 국가법령정보센터 **같은 시행판 제614조**: https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759 . 인가와 관련하여 법률 적합·공정·형평·수행가능·비용 및 인가결정일 기준의 파산 배당액 비교 등은 단순 월합계와 별도다. **법원의 인가를 코드가 대체하지 않는다.**
3. 서울회생법원 공식 공지: **2026-10-01 작성**, 제424호 제2조 제2항 **제7호 신설**: https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187 . 현재 `reference-parameters.json` `param.seoul.shortened_term.effective_from="2026-10-01"`, `verification="inherited"`, `changePolicy="human_review_required"`; `lib/seoul424-candidate.ts`는 firstFilingDate와 직접 비교하고 `candidate_for_human_review`만 반환한다. **보도일=개별사건 시행일이라고 검증되지 않음**. 공식 실무준칙 PDF https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf 에 대한 원문 상세 탐색/페이지 스크린샷 호출 모두 타임아웃; **부칙·경과조치·적용사건·법원별 차이 검증 불완료**. 이 값을 자동 확정·무승인 법률 룰로 승격하지 않는다.
4. 국세청 안내: https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486 . 일반과세자 VAT 반기, 간이과세자 연간 신고기간과 종소세 연간 과세소득(총수입-필요경비 등)은 별도. **VAT 총매출/세액/종소세 신고값 ≠ 직접 확정된 개인회생 월가용소득**. 개별 법적 인정은 변호사·세무실무자 미인증.

법원·관할·사건 접수일·법령 판본·법률검토자 승인 없는 계산값은 본 법률 감사에서 **source-only / provisional / review_required**이며 법률 확정으로 승격하지 않는다. 특히 조건부 월 48/60개월에는 특별사정과 실제 제614조 요건 검토 필요.

## 4. 4개 ID 결과 및 다음 작업

- **A2-LAW-014 [ ]**: 36/48/60 직접 생성 월배분 15개+수동변동 3개 독립 기대값/실제 V8 확인, 법 §611 원문 판본 확인. 61/72 원장 단독과 상위 60개월 검증 구분. 법률상 적합성/변동계획 승인 미인증.
- **A2-LAW-015 [ ]**: 2026-10-01 서울 신설 제7호 공지 확인, reference effective_from inherited 직접 검토. 부칙·경과/사건별 효력일 원문 PDF 미검증 및 무승인 자동적용 금지.
- **A2-LAW-018 [ ]**: 제614조 법원 인가 조건 원문 대조; 기본 월 3원/월제안2원, 36·48·60 월별 제안 초과는 추가 검토 대상이지 원장합계만으로 법률 합격이 아님. 수동 변동계획의 원장 complete 또한 법률 완료 아님.
- **A2-LAW-022 [ ]**: 월제안 `null`과 명시 0, 부정합 JSON/SQL, 61/72 단독 원장 provisional, draft status와 법원 승인 분리. 부정합 SQL·미관찰 자동승격 여전히 위험.
- **수정 없음:** 선행 #133은 Draft, 기존 #25/#29/#43/#130도 Draft; 서로 다른 해결안 무조건 병합하지 않았다. 이번 검증은 정적 소스 독해/V8 격리 및 SQLite DDL 합성. **전체 Node/CI·staging D1/R2/Cron·실제 DOCX 공식서식 동등성·변호사/계산사무장 최종 승인·사이트 배포 미검증**.
- 다음 회차 **A2 55차 데이터담당자**: 원문/Fact/typed/SQL 결과 중 0/null/상충 상태 재생과 `source_fact_ids_json` 유효성, 소득원별 계보, #133/#25/#29/#43/#130 병합 전 실제 Node 합성 E2E, approved 36/48/60 월별 원장 값과 D5110/D5111 토큰 대조. 제424호 부칙 전문 사건 적용일 확보는 변호사 검토로 별도 보존.
- **제품 인수 완료 0건.** main 제품 수정 0, 운영 배포/D1 운영 마이그레이션/실전자제출/법원 인가 확정 0. 고객문서/개인정보/원본 OCR/키/.env/비공개 정답 없음.
