# FirmEngine A2 r104 — AX담당자 / 세금채권·우선채권 정책 승인 경계 결합

- 감사: **2026-11-03 KST**; 역할 회전 r103 데이터담당자 → **r104 AX담당자** → r105 IT담당자. 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만.
- 최초 확인 **main HEAD** `fd32b356dc783e88c5d0523271c7d03d9364f999`. 최신 main 보드 blob `9b74edac0c57a043c5878bd18d6fee65063bb7a6` (게시 직전 재조회 별도). 이전 r103 [영수증](2026-11-03_r103_1916KST_data-priority-policy-evidence-sql-pr221.md) 확인. 관련 main 코드: `lib/plan-reconciliation.ts` blob `1c895fd2fd8a133368315532ed2ab9984d64b2e3`, `lib/repayment-plan-model.ts` `6b9e53caba3be1eab17373956aa19717cfeec980`, `lib/case-execution.ts` `752049c087cc28b2d713eafb5dc3f7294623e8ae`, `lib/office-writer.ts` `78c351a0d7ef8432c24f5c4a7ba9cff0410a8568`.
- 기존 미병합 Draft: [#194](https://github.com/firmengine/firmengine/pull/194) tax-class parity, [#203](https://github.com/firmengine/firmengine/pull/203) 미등록 분류/재원, [#215](https://github.com/firmengine/firmengine/pull/215) provisional 최종게이트, [#221](https://github.com/firmengine/firmengine/pull/221) 정책 누락 검토보류. 194/203/221은 `lib/plan-reconciliation.ts` 변경 **중복**, 215는 호출부 별도 변경. 병합·전체 통합 검증 **미완료**.

## 1. 신규 교차 반례 — #221만으로는 세금채권 검토보류 안 됨

- 실제 main 및 Draft #221: `reconcilePlanLedger()`의 `isPriority`는 `debt.classification === "tax"`를 포함하지 않음. 반면 main `buildRepaymentPlanModel()`은 세금으로 분류한 채권을 `claimClass:"priority"`로 생성. 따라서 **tax로만 분류된 채권의 priorityCoverage 자체가 누락**될 수 있음. 36/48/60개월 원금 1원/월 전액 배분인데 세금채권 우선권 근거·정책 미관찰이면 `priorityCoverage["SYN-D"]` 값 **없음**, `legalReviewTasks=[]`, `status=reconciled`를 실제 확인. 이는 **기술적 재대조 성공/법적 우선권 확정**이 다름을 보여주며 법원 제출 성공 관찰은 아님.
- #194는 tax를 `isPriority`에 추가하여 누락 커버리지는 복원하지만, 우선채권 정책이 없는 경우에도 전액 배분이면 `covered`로 판정함. **#194 단독으로 #221의 문제를 해결하지 못하고 #221 단독으로 #194의 tax 누락을 해결하지 못함**.
- 실제 호출부 `executeCaseNodes()`, `writeOfficePackage()`는 우선권 확인정책 인수를 전달하지 않음. #194+#221 결합시 우선권 미승인 사건은 `unknown`+법률검토과제를 통해 최종 출시를 보류하는 방향이나 승인자/동일 사건 Fact/시행일/관할/법원·인정 판단 연동 없이 `confirmed` 입력을 자동 주입하면 안 됨.

## 2. 합성 입력 / 독립 기대 / 실제 관찰

- 입력은 모두 공개 가능한 `SYN-` 합성값: 원문/Fact 신뢰 없는 `SYN-FACT`, 데이터는 `CaseData.debts[].principal/interest.amountWon` 문자열, `priority/classification`, `PlanLedger.rows[].{claimClass,principalWon,interestWon,otherComponentWon,balanceAfter,sourceIds}` 필드로 구성. `planMonths=36/48/60`, 원금 `36/48/60원`, 월별 원금 `1원`, 이자·기타액 `0원`. 독립 BigInt 기댓값 `1원×36/48/60회 = 36/48/60원`. `tax`는 `priority:"ordinary"`, `classification:"tax"`, row `claimClass:"priority"`; `priority`, `estate`는 각 우선종류. 정책은 absent/empty/confirmed/unknown, 전액 미지급, 명시적 0원·정책 없음 등 6조건.
- `3기간 × 3종류 × 6조건 = 54` 조건을 **실제 GitHub 원 함수에서 타입 선언 표면만 제거한 V8 격리 본문**으로 비교: **#194 27/54 기대 일치 → #194 + 정책 명시확인 가드 54/54**. 기존 27건 문제는 누락/빈 정책/정책 없는 명시적0원 채권이 `covered`로 판정됨(각 9종×3기간).
- 수정후 기대: 정책 미관찰/빈맵/unknown/정책 없는 0원 → `priorityCoverage.status=unknown`, `PRIORITY_COVERAGE_POLICY_REVIEW:SYN-D` 1개; 명시적 기술 검토 confirmed·전액 지급 → `covered`; confirmed·미지급 → `blocked` 및 미지급 issue. confirmed는 **합성 기술 상태**이고 실제 변호사 승인 아님.
- **신규 커밋 테스트파일 원문 본문도 격리 V8 실행 54/54 PASS + TODO 3건 확인**(`node:test` 및 `normalizeMoney`는 격리 대역으로 치환). 실제 프로젝트 `node --test` 실행/TypeScript 검사/CI **수행하지 않음**. #194 기존 24개 합성 테스트는 정책 입력을 명시 confirmed로 바꾸어 기대 의미 충돌을 정리했지만 프로젝트 러너는 미실행.
- 알려진 미해결: 비정상 `principalWon="1,20"`이 `SyntaxError`를 발생시킴; #203 미등록 채권분류·재원 검증 및 #215 잠정원장 최종게이트 병합/충돌 시험 별개. 비정상 수치를 가짜 0원으로 바꾸지 않음.

## 3. 수정안과 PR HOLD

- **[Draft PR #222](https://github.com/firmengine/firmengine/pull/222)** — #194 기반 **stacked PR**, 부모 #194 head `14752a28f63e22805bbb35321cf873f52878e960`.
- `lib/plan-reconciliation.ts` `policy?.applicability==="unknown"` → `policy?.applicability!=="confirmed"` (**금액·채권의 자동 법적 인정 판단 추가 없음**), blob `2a3645defb2b613da68f3a9044f149713925fd4e`→`60bed62146a254c2c08937592ebd308c3fa96858`.
- `tests/a2-r84-law-tax-priority-review-parity.test.mjs` 기존 합성 confirmation 전달로 기존 기대 유지; `tests/a2-r104-ax-tax-policy-combined.test.mjs` 신규 54개 + TODO3. PR head `dc4a1c81c8ff09f625e49085e6e0f6566491d029`.
- main 제품 코드 **수정 없음**. #222는 Draft/HOLD, #194/#203/#215/#221과 충돌·전체 CI/법률 검토 해결 전 병합 금지. #222 생성 직후 mergeable=false(비동기 계산 전), 이어서 재조회 결과 **mergeable=true**(부모 #194 대비) 확인. **main 병합 적합/PR #203·#215·#221 충돌 해결/전문가 승인 의미 아님**. 원본 고객 사례/개인정보/OCR 사실값/키/.env 저장 없음.

## 4. 계약·법적 원문 및 단계 경계

- main `lib/reference-decision-tables.json` `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` JSON 재파싱: **18모듈/91입력 선언/42출력 선언/42 resultPaths**, main `lib/template-token-catalog.json` `899c4d564fcb1726861f89dcf04dbf1b7e372687`: D5103 **37**, D5106 **48**, D5110 **55**, D5111 **82** 등록 토큰. *정적 계약만*: 18개 전체 엔진 실행/91입력 실제 소비/42 SQL output/서식 실제 Word 재독 **미실행**.
- 서울회생법원 [2026-10-01 공지](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187): 제424호 제2조제2항 제7호 신설 공지 직접 확인. 공식 실무준칙 [PDF](https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf?v=2)는 이전 r103에서 본문·부칙 확인 기록(2026-09-23 개정, 2026-10-01 시행, 이후 최초 접수 사건 적용); **이번 회차 PDF 새로고침은 타임아웃으로 직접 이미지 재확인 못함**, 사건별 관할·증빙·부칙 적용은 미인증.
- 법제처 국가법령정보센터 법률 제21490호 **2026-10-02 시행판** 제[611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR)와 제[614조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR) 본문 직접 확인. 611조 우선권/재단채권 전액변제 계획 기재·기간, 614조 인가요건은 `covered`와 동의어가 아님.
- 국세청 [VAT 과세기간 공식 안내](https://t.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486) 직접 확인: 일반과세자 반기, 간이과세자 원칙상 연간. VAT 신고매출은 법원 인정 월별 순소득과 다름. 이번 회차 VAT/종소세 급여 실제 산식 수치시험은 미실행. 세금채권의 **법적 우선권·납기·개별 사건 적용** 실무 검토 필요.

## 5. 보드 ID / 다음

- `A2-AX-004 [ ]`: 정책 미관찰/null/0/unknown/confirmed 상태 분리. 합성 verified=none, 실행=격리; 실제 Fact·SQL 미인증.
- `A2-AX-015 [ ]`: 원함수+독립 `BigInt` 54조건 54/54 후보 기대 충족, 18/91/42 정적 재파싱. 전체 엔진/CI·SQL/Word 미인증.
- `A2-AX-017 [ ]`: `priorityCoverage.covered`도 법률상 인정 아님. 승인 Fact/시행일/법원 확인 및 인간 검토 게이트 부재; PR Draft HOLD.
- `A2-AX-018 [ ]`: 원 blob SHA·합성 입력·독립기대·관찰·수정PR·미실행 단계·출처를 영수증에 구분 기록. 최종 제품 RELEASE_READY **0건**.
- **r105 IT담당자**: #222/#194/#203/#215/#221를 격리 Node + 프로젝트 러너에 함께 올려 충돌 해결; malformed Won의 무예외 fail-closed 계약(0과 null 혼동 금지), source Fact 소유·판본·정책 승인자; D1/API→42출력→D5103/D5106/D5110/D5111 Word 재독 확인. 사람 검수(변호사·계산사무장) 전 확정 규칙 적용/배포 금지.

**단계:** 코드/합성 격리 PASS/신규 테스트 본문 격리 PASS ≠ 프로젝트 Node 테스트/CI ≠ staging D1·R2/Cron ≠ DOCX 실제 재독·공식서식 동등성 ≠ 변호사 승인 ≠ 운영 배포. 운영 D1 migration·전자제출·인가 확정/운영배포 하지 않음.
