# FirmEngine A2 r105 — IT담당자 / 잘못된 원장값 차단과 0원 출력 혼동 감사

- 회차: 2026-11-03 KST. 순환: r104 AX담당자 → **r105 IT담당자** → r106 사용자·서류담당자. 범위 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만.
- 조회 시점의 main SHA **`01cd7b265ec101acc8cacb2796e0cb10b7aeebf3`**. 인수 보드 blob `2016deb287c0111ad036d09556a3f34affef180c`. 이전 [r104 영수증](2026-11-03_r104_2015KST_ax-tax-policy-combined-pr222.md) 및 기존 [r101 원장 오류](2026-11-03_r101_calc-malformed-ledger-bigint-guard.md), [r103 정책 SQL](2026-11-03_r103_1916KST_data-priority-policy-evidence-sql-pr221.md) 참고. 최신 main의 관련 파일과 Draft #29/#43/#194/#203/#215/#221/#222를 조회하고 변경 경계를 대조함.
- 직접 재독한 원본 파일 blob: `lib/plan-reconciliation.ts` **`1c895fd2fd8a133368315532ed2ab9984d64b2e3`**, `lib/repayment-plan-model.ts` **`6b9e53caba3be1eab17373956aa19717cfeec980`**, `drizzle/0011_case_calculation_features.sql` **`0caa359d250dce45765d269d271ad63170ec3efa`**, `lib/reference-decision-tables.json` **`6924e3977caf748ce8a3d617fae15aff7d2fe2ce`**, `lib/template-token-catalog.json` **`899c4d564fcb1726861f89dcf04dbf1b7e372687`**. 코드/드래프트 파일들은 **독립적인 원본문 격리실행**으로만 검증.

## 1. 원장 원문 함수 / 합성 입력 / 독립기대 / 실제

- 합성 `CaseData.debts = [{id:"SYN-D",classification:"tax",priority:"ordinary",principal.amountWon:"36"/"48"/"60",interest.amountWon:"0",factIds:["SYN-F1"]}]`. 월별 `PlanLedger.rows` 36/48/60개, 각 정상 `principalWon:"1",interestWon:"0",otherComponentWon:"0"`, `fundingSourceId:"priority_budget"`, 정수 잔액 감소, `paymentSchedule.expectedInstallments`는 기본 기간, 확인정책 absent/confirmed/unknown. 원장 상태 `complete`. 독립 산술 기대 **월 1원 × 36/48/60개월 = 36/48/60원**(원금 전액 소진), 0원은 별도 합성 입력. 모든 ID 및 수치는 SYN 합성, 실제 개인 사례 아님.
- 각 기간 × 9유형(세금정책 미제공/확인/unknown, 잘못된 원금 `1,20`/이자 `0a`/기타 `1,,000`/잔액 `bad`/분류 `other`, 정책 없는 명시적 0원) = **27조건**. 실제 GitHub `reconcilePlanLedger` 함수본문에 대해 TypeScript 타입 표면만 제거한 JS V8 격리실행. **독립 기술기대 충족 main 3/27, Draft #203 6/27, Draft #222 15/27**. 서로 다른 코드판본의 비교이며 전체 제품 실패율을 뜻하지 않음.
  - main tax-only 채권 정책 미제공/confirmed/unknown에서 `priorityCoverage` 누락·빈 검토과제, 비정규 원금/이자/기타에서 **SyntaxError**; `other` class는 reconciled 오판.
  - #203 reconcile blob `fcefc9239808c9c1356b6eb4bc438efe5ac51bf9`: 미등록 분류 일부 차단, tax-policy·`BigInt` 오예외 여전.
  - #222 stacked head `dc4a1c81c8ff09f625e49085e6e0f6566491d029`, reconcile blob `60bed62146a254c2c08937592ebd308c3fa96858`: tax/정책 absent·unknown→`unknown`+법률검토, confirmed→`covered`; 하지만 원금/이자/기타 오류 **9/9 SyntaxError**, 미등록 class **3/3 reconciled**. #222는 #194 기반 stacked Draft; #203 및 #43와 단독 병합 불가.
- 기존 [Draft #43](https://github.com/firmengine/firmengine/pull/43) reconcile blob `3eca93d20dfb9a851c26262ece8e1d5a69d932ed`: **다른 별도 27조건**(36/48/60개월 × 정상 1원/실제 0원/원금·이자·기타·잔액·class·재원·null 오류). **예외 0건, 구조오류 21건 모두 `blocked`**로 정지. 하지만 그 21건의 반환 `totals.principalWon/interestWon/otherComponentWon/totalWon/ordinaryWon/priorityWon/estateWon/trusteeFeeWon`이 모두 **문자열 `"0"`**임을 확인. 정상 원장 36/48/60원과 진짜 0원은 별개. `blocked` 게이트를 우회하거나 `totals` 소비자가 직접 저장·표시하면 **누락/오류를 실측 0으로 오인**하는 위험. #43의 주석 'zero placeholder'는 SQL/API/D5103·D5110·D5111이 금액을 결코 소비하지 않음을 증명하지 않음. 이 경계 때문에 **#43 자동 병합 금지**.
- #29의 `buildRepaymentPlanModel()` 미확정 원금·이자 차단 패치는 기존 Draft로 존재, 이번 main 미병합. main의 기본/명시 스케줄에서 `BigInt(debt.*?.amountWon ?? "0")`가 null→0으로 보간될 수 있는 코드 정적 재확인. **전체 Node 프로젝트 테스트·실제 API/E2E 미실행**.
- PR 검토의견에 수치 기재: #43 [comment #6603552475](https://github.com/firmengine/firmengine/pull/43#issuecomment-6603552475), #222 [comment #6603553206](https://github.com/firmengine/firmengine/pull/222#issuecomment-6603553206). **제품 코드는 변경하지 않음.** 사용자 승인 없이 법적 의미·금액 계약 변경도 하지 않음.

## 2. 실제 SQL 구조와 0/null/Fact 소유 경계

- main `drizzle/0011_case_calculation_features.sql`의 3개 CREATE TABLE 및 인덱스 정의에 맞춰 Python SQLite **3.46.1 인메모리 동형 DDL** 실행(실제 D1 아님). `cases(id)`의 SYN 행 1개 및 `case_calculation_runs` SYN 실행행, `case_calculation_features` 8개 합성 insert 시나리오.
- **8개 실제 관찰:** 정상 명시 `value_json="0",value_won="0"` 수락; 미관찰 `value_json="null",value_won=NULL` 수락; **상충** `value_json="null",value_won="0"` 수락; `source_fact_ids_json="42"` (배열 아님) 수락; 동일 run/output/path 서로 다른 feature ID 중복 수락; **다른 사건 소유를 흉내 낸 Fact ID** 수락; 미존재 run FK **IntegrityError 거부**; 미존재 case FK **IntegrityError 거부**. `PRAGMA foreign_key_check` 빈 결과. DB 단독 FK는 run/case를 막지만 Fact ID 실존·타사건 소유·원화/JSON 정합성을 보장하지 못함.
- 이것은 실제 원문/OCR→Fact→typed→D1→계산→42 output→DOCX 재독 **아님**. 실제 D1·R2/Cron/SQL 저장 프로시저 및 front/API 흐름 미관찰. 원천 Fact 인정, 미관찰, null, 0, source-only, 상충, 승인전은 혼합 금지.

## 3. 정적 계산·서식 계약 재파싱

- main `reference-decision-tables.json`: `calculations` **18모듈**, `inputs` 합계 **91선언**, `outputs` **42선언**, `resultPaths` **42**. `template-token-catalog.json`: D5103 **37**, D5106 **48**, D5110 **55**, D5111 **82** token. **정적 JSON 재파싱**만. 모든 91개 입력 실제 소비, 전체 산식 실행 및 42개 SQL 결과·모든 서식 토큰 값 대조한 것으로 표시 금지.

## 4. 공식 원문 / 기준일 경계

- 서울회생법원 [2026-10-01 공지](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187): 제424호 제2조 제2항 제7호 신설을 **이번 회차 직접 열람**. 실무준칙 [개정 PDF](https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf?v=2)는 **이번 회차 타임아웃**, 이미지/부칙 신규 검증 실패. r103/r104의 2026-09-23 개정/2026-10-01 시행·이후 최초접수 사건 적용 기록을 인용하되 이번 신규 검증으로 표시하지 않음. 사건별 최초 접수일 증빙·관할·부칙 적용/변호사 승인 **미인증**.
- 국가법령정보센터 **[채무자회생법 2026-10-02 시행판 제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR)**(재단·우선권 채권 변제계획 기재, 원칙 3년/특별사정 5년), **[제614조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR)**(인가·청산가치·형평 등) 본문 직접 열람. 원장 `reconciled`나 `covered`가 법원 인가/적법성 인증을 의미하지 않음.
- 국세청 [부가가치세 과세기간](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574) 직접 확인: 일반과세 6개월, 간이과세 통상 1년. VAT 신고매출/종소세 신고 자료를 법원 인정 월순소득으로 자동변환하지 않음. VAT·종소세 실제 금액 중복제거 수치시험은 이번에 미실행.

## 5. 체크 ID / 수정 / 다음

- **A2-IT-006 [ ]**: BigInt malformed main/#203/#222 예외, #43 차단 21건 및 반환 문자열 `"0"` 위장 위험. 구조 차단 개선≠0/null 계약 검증.
- **A2-IT-015 [ ]**: 0011 동형 SQLite 합성 8조건과 FK 2거부; 실제 D1 저장/typed API 왕복/42피처·Word 대조 미실행.
- **A2-IT-020 [ ]**: 런타임 잘못된 문자열·미등록 class·제3의 source 검증 및 0/null 혼동. PR #203/#222/#43 통합과 회귀시험 미완료. 계보·승인 검증 미인증.
- **수정:** 제품/법률·금액 의미의 무승인 변경 없음; #43/#222에 실제 검증 결과 댓글 2건 기록, main에는 이 감사 영수증/위 세 ID의 미완료 기록만 업데이트.
- **r106 사용자·서류담당자 후속:** Draft #29/#43/#194/#203/#215/#222/관련 form projection #219/#220를 우선 소스/blob/branch 대조. `blocked` 합계의 스키마(정말 미관찰/null이어야 하는 값) 및 전 소비처 안전성 회귀를 **별도 Draft**로 설계하고 실제 Node/TS/SQL→D5103/D5106/D5110/D5111 Word 재독 실행. 운영 D1 migration/운영배포·전자제출·법원 인가 확정 금지, 변호사·계산사무장 최종 승인 전 법률 적합성 미인증. 전체 제품 RELEASE_READY **0건**.

**단계 구분:** 코드 존재/원함수 V8 합성/SQLite 동형 구조 실험 ≠ 프로젝트 Node/전체 CI ≠ 실제 staging D1·R2/Cron ≠ 법원서식 Word 재독 ≠ 공식 서식 동등성 ≠ 실무 법률승인 ≠ 운영배포.
