# FirmEngine A2 r125 — 계산사무장: 기간 누락 및 일반채권 변제합계 허위 재대조 방지 (Draft #237)

- 일자: 2026-11-04 KST. r124 사용자·서류담당자 다음 계산사무장 순환. 허용범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래만.
- 감사 시작 main HEAD: `7ac8b078521cf7c71b7d3480e2e215762da1c218`. 최근 main 3개: `7ac8b07` A1 board, `d4d1753` A1 receipt, `d67e6f1` A3 board. 최근 open PR #236(채권 출력총계), #235/#234(소득서식), #229(월별), #43/#203/#222(원장 분류·정책) 재조회.
- 읽은 소스: `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` blob `8526647eff4433929d479dc3d5da21dc276cc6de`; 직전 `r124` receipt blob `1ad17d3ceb64ff66599c6f6acf6e4328abdb18a9`; `lib/plan-reconciliation.ts` blob `1c895fd2fd8a133368315532ed2ab9984d64b2e3`; `lib/repayment-plan-model.ts` `6b9e53caba3be1eab17373956aa19717cfeec980`; `lib/document-preflight.ts` `dc771c0ff0497d24df19478b0366ebbb397bfbf2`; `lib/case-calculation-feature-store.ts` `bb5f88b26e68f5ae2234741063ac9301a927e27a`; `drizzle/0011_case_calculation_features.sql` `0caa359d250dce45765d269d271ad63170ec3efa`.
- 직전 r124 [영수증](2026-11-04_r124_doc-creditor-total-unverified-pr236.md); 이번 A2 계산 체크 ID: **`A2-CALC-025`, `A2-CALC-026`, `A2-CALC-030`** 모두 [ ] 유지. 원장·서식·법원 승인 전 제품 인수 완료 0건.

## 실제 코드의 신규 P1 위험 후보 두 유형

1. `reconcilePlanLedger()`의 `expected=context.paymentSchedule?.expectedInstallments??context.planMonths??0`는 0/null/음수일 때 월 누락검사를 건너뛴다. `ledger={status:"complete",issues:[],rows:[]}`, debts=[]와 `planTotalWon="0"`이면 **status="reconciled"** 반환. 이는 자료가 없어 관찰하지 못한 기간과 명시적 0원 변제를 같은 의미로 오인할 수 있다.
2. 일반채권 지급합계와 `calculation.planTotalWon`이 다를 때 `legalReviewTasks=["ORDINARY_ALLOCATION_UNRESOLVED"]`만 추가하고 `issues=[]`, `status="reconciled"`를 유지한다. 합계 자체가 null이면 대조 생략, `"1,20"`이면 BigInt SyntaxError 발생. 누락/null/형식오류/상충/정상0을 분리해야 한다.

## 합성 입력·독립 기대·관찰

사례 기반: `{"context":{"planMonths":36,"paymentSchedule":null,"monthlyTrusteeFee":{"amountWon":"0"}},"debts":[{"id":"SYN","principal":{"amountWon":"36"},"interest":{"amountWon":"0"}}]}`, `calculation={"ordinaryRepaymentBudgetWon":"1","monthlyPaymentWon":"1","disposableIncomeWon":"1","planTotalWon":"36"}`, `ledger={"status":"complete","issues":[],"rows":[{"installment":1..36,"debtId":"SYN","claimClass":"ordinary","principalWon":"1","interestWon":"0","otherComponentWon":"0","balanceAfter":"35".. "0"}]}`. 모두 완전한 가상 원화·Fact이며 실제 고객/원본 OCR 없음.

- 독립 산술: 각 36/48/60회×1원 = 36/48/60원; 명시적 0원×36/48/60회 = 0원. 독립 기대는 양쪽 합계 일치·유효기간·0원 관찰 시에만 `reconciled`.
- 매 기간 9개 조건: 정상, 실제 관찰 0, 계획합계 +1원 불일치, 계획합계 null, 비정상 `1,20`, 기간 0/null/음수/소수. 총 **27조건**.
- GitHub main **기대 9/27**, 비정상 계획합계는 3회 SyntaxError. 36/48/60 × (기간 0/null/음수 또는 계획합계 불일치/null)에서 허위 `reconciled`.
- 별도 Draft [#237](https://github.com/firmengine/firmengine/pull/237) 커밋된 소스 **27/27 기대 일치**, 예외 0. main 비교는 GitHub 원래 `plan-reconciliation.ts` 함수에서 TypeScript annotation만 제거한 V8 **격리 함수 본문 실행**. 테스트 대상 source 경로/구조는 실제 GitHub 소스, 독립 기대값은 별도 손계산/상태계약. **프로젝트 Node 러너 아님**.

## 조치/경계

- [Draft PR #237](https://github.com/firmengine/firmengine/pull/237): `lib/plan-reconciliation.ts`에서 `PLAN_TERM_UNVERIFIED`, `ORDINARY_PLAN_TOTAL_UNVERIFIED`, `ORDINARY_PLAN_TOTAL_MISMATCH`를 `issues`에 넣어 기술 재대조 HOLD. 기존 일반채권 검토작업 `ORDINARY_ALLOCATION_UNRESOLVED` 유지. 계산 값 변경 없음.
- 코드 변경 파일 1개, 신규 합성 Node 테스트 `tests/a2-r125-plan-term-ordinary-total-hold.test.ts` 27개 선언+TODO 1개. 초안 소스 blob `118e63e543000f2e3cd1cea0a56c47347124929f`, PR HEAD `c578a87bef02067eebb857d9f7094a0c40435329`. 부모 main `7ac8b078521cf7c71b7d3480e2e215762da1c218`; 2개 파일 모두 ax-site 내부. 미병합 Draft. 프로젝트 Node 테스트는 **작성만 했고 실행하지 않음**.
- 법적 기간 적용이나 우선채권·회계 인정·최종 인가 판단에는 변경 없음. 상태 계약 변경은 계산사무장·변호사 실무 검토 후 #43/#203/#222/#229 및 #200→#236, #234→#235와 충돌·통합 재검토 필요.
- JSON 기준정보를 직접 파싱: 18 계산모듈, 91 입력 선언(78 고유), 42 출력 선언(40 고유)/42 고유 resultPath. 등록 서식 토큰 D5103 37 / D5106 48 / D5110 55 / D5111 82. **정적 계약 확인**일 뿐 전체 계산 실행이나 실제 DOCX 생성/재독 아님.
- SQLite DDL/typed store는 읽었지만 이번 회차 SQL INSERT/SELECT **미실행**. 따라서 실제 원문→Fact→typed→SQL feature→D5110/D5111 종단 부적합 확정 아님.

## 공식 원문/시행 버전과 인증 경계

- 서울회생법원 공식 [실무준칙 제424호 개정전문](https://slb.scourt.go.kr/rel/information/qna/practice_rule.pdf?v=2) PDF 실제 이미지 p272=인쇄252(2026-09-23 개정), p273=인쇄253(제7호 4개 누적요건), p392=인쇄372(부칙 **2026-10-01 시행·시행 후 최초 접수 사건 적용**). **서울회생법원** 한정, 최초 접수증의 Fact/관할/승인 연결 전 자동 규칙 적용 금지.
- 국가법령정보센터 [2026-10-02 시행판 채무자회생법](https://www.law.go.kr/lsSc.do?eventGubun=060101&menuId=1&query=%EC%B1%84%EB%AC%B4%EC%9E%90%20%ED%9A%8C%EC%83%9D%20%EB%B0%8F%20%ED%8C%8C%EC%82%B0%EC%97%90%20%EA%B4%80%ED%95%9C%20%EB%B2%95%EB%A5%A0&subMenuId=15&tabMenuId=81) 법률 제21490호 시행일 확인; 제611조·제614조 개별 조문 링크 직접 재조회 실패, **개별 조문 새 인증 없음**.
- 국세청 [부가가치세 과세기간](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7802&mi=2355) 일반과세자 6개월·간이과세자 원칙 1년 확인. VAT/종합소득세 신고자료를 인정 월순소득으로 자동 인정하지 않음.
- 법률/세무/회계 적합성은 변호사·계산사무장 실제 승인 전 **미인증**. `미관찰/null/0/비해당/상충/source-only/승인전` 값은 서로 다른 상태.

## 체크 ID / 다음

- **A2-CALC-025 [ ]**: 월별 예산·합계와 계획 총액의 기술 교차대조 27건; 재대조 오류 후보 미병합. 실제 계산엔진/D1/서식/채권분류 승인 미검증.
- **A2-CALC-026 [ ]**: 36/48/60회·0/null/음수/소수 기간 경계. 실제 단축 회차·phase 월말 anchor·잔여원·법적 기간 승인 미검증.
- **A2-CALC-030 [ ]**: 원문 함수 V8 27조건, Draft 테스트 27개 작성. 전체 18모듈/91입력·Node 프로젝트·CI/Word/SQL E2E 미검증.
- 다음은 **변호사 관점**. Draft #237의 상태 의미를 검토하고, #43/#203/#222/#229/236과의 순차 통합·전체 Node 테스트, 원천 Fact/SQL feature→D5110/D5111 실제 Word 생성·재독·36/48/60월 예산·잔여원 재검산을 이어갈 것.

전체 CI, staging D1/R2/Cron, 공식 서식 동일성/변호사 인수, 사이트 운영 배포/운영 migration/전자제출/법원 인가 **전부 미실행·미인증**.
