# FirmEngine A2 r126 — 변호사: 잠정 변제원장 재대조 승격 차단 및 미승인 우선채권 정책

- 실행: 2026-11-04 KST, 이전 r125 계산사무장 → 이번 r126 변호사 → 다음 데이터담당자. 범위는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 이하만.
- 시작 main HEAD `1ae446dc3af6c833cc1efed391d3c7432bd98871`, 영수증 쓰기 전 main HEAD `1ae446dc3af6c833cc1efed391d3c7432bd98871`. 최근 main r125 A1/A3 문서 및 A2 r125 기록 확인. 단일 보드 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` blob `06bf1613fb6e103d20989d576df86a8f096320ce`, 직전 [r125 영수증](2026-11-04_r125_1714KST_calc-plan-term-total-hold-pr237.md) 재독.
- 실제 소스: main `lib/plan-reconciliation.ts` blob `1c895fd2fd8a133368315532ed2ab9984d64b2e3`, [#237](https://github.com/firmengine/firmengine/pull/237) blob `118e63e543000f2e3cd1cea0a56c47347124929f` / head `c578a87bef02067eebb857d9f7094a0c40435329`; `lib/repayment-plan-model.ts` blob `6b9e53caba3be1eab17373956aa19717cfeec980`, `lib/assessment.ts` blob `ee0f12bdf0a47f0503a2c9c749562b3f4a9f6ac5`, `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`, `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`, 기존 r102 변호사 감사 재독.
- PR 검토: open Draft #237(기간/계획합계), #236(채권 출력총계), #235/#234(소득서식), #229(변제원장 null), #194/#203(우선/분류) 중 미병합 상태. 운영 변경, 기존 PR 병합 없음.

## 1. 실행한 합성 30조건 — 실제 소스 V8 격리

`reconcilePlanLedger`의 main과 #237 TypeScript 함수본문에서 타입 선언만 제거. `moneyValue`는 합성 `{amountWon:"0"}`만 해석하는 대역. 36/48/60개월 × 다섯 변형 × 두 버전 = **30회 직접 실행**, 프로젝트 Node 러너/CI는 **실행하지 않음**.

공통 합성 `CaseData`: `context.planMonths=36|48|60`, `paymentSchedule=null`, 수수료 0원/우선배분 0원/재단배분 0원, 채권 1개 `SYN-A` 원금=해당 개월수(원), 이자 0원. `CalculationResult`: 월 일반채권 예산·월 변제액·가용소득 1원, `planTotalWon="36"|"48"|"60"`. `PlanLedger`: 월 1원씩 해당 개월수만큼 행(채권·월별 `balanceAfter`), `status=complete`, `issues=[]`. 독립 산술 1원×36/48/60개월=**36/48/60원**. 실제 이용자·OCR·법률상 인정액 아님.

| 변형(각 36/48/60개월) | 독립 기대/보수 검토 | main 실행 | #237 실행 |
| --- | --- | --- | --- |
| `complete` 정상 합계 | 기술 `reconciled`, 총액=개월수 원 | 3/3 `reconciled` | 3/3 `reconciled` |
| 같은 합계지만 원장 `provisional` | 승인 전/잠정 → 확정 기술재대조 보류 | **3/3 `reconciled`, issues=[]** | **동일** |
| 우선채권 전액 납부, `priorityPolicies` 미제공 | 법적 우선권·납기·개별승인 상태 `unknown` 유지 필요 | **3/3 `covered`, 법률 검토 과제 0** | **동일** |
| 첫 행 금액 `"1,20"` | 금액 오류 차단 및 반환(0원 보정 금지) | **3/3 `SyntaxError`** | **동일** |
| 유효행이 있으나 기간 0 | 기간 오류 차단 | **3/3 `reconciled`** | 3/3 `blocked: PLAN_TERM_UNVERIFIED` |

**의미:** 기존 [r102 변호사 감사](2026-11-03_r102_1812KST_law-policy-ledger-failure-contract.md)의 잠정원장 오승격이 #237에서도 해결되지 않았음을 새 30조건으로 확인. `buildRepaymentPlanModel()`는 미검토 자동생성 기본원장을 명시적으로 `provisional`로 반환하므로 실제 생산 가능한 계약의 경계다. 다만 상위 최종 문서 게이트의 실제 동작/실제 제출 허용을 이번에 입증한 것은 아니다.

## 2. 별도 수정 Draft #239 — 잠정원장 기술 재대조 보류

- [Draft #239](https://github.com/firmengine/firmengine/pull/239) 는 **#237의 head `c578a87...`를 부모로 생성한 stacked PR**; base는 `audit/a2-r125-calc-term-plan-total-hold-20261104`, main 아님. 변경 범위: `lib/plan-reconciliation.ts` 단일 검사 3줄, `tests/a2-r126-law-provisional-ledger.test.ts` 신규 합성 시험.
- 추가: `ledger.status!=="complete"&&ledger.status!=="blocked"`이면 `PLAN_LEDGER_NOT_REVIEWED`를 `issues`에 기록. 원장 금액·법률상 기간·우선권 규칙·서식 텍스트는 변경하지 않음. 기존 blocked 사유 보존.
- PR 전 메모리 가상패치에 대해 실제 #237 함수본문 V8 36/48/60 × (complete, provisional, blocked, observed-zero provisional) **12조건 실행**: 원본 기대 6/12, 보완 후보 **12/12**. 정상/명시적0 산술 보존. 실제 PR GitHub 커밋 코드 blob `55990eba448694338afc8e1a965473d7134064b6` 재조회해 패치 존재 확인. 합성 Node 13조건+TODO 2개는 **작성·커밋했지만 프로젝트 Node 러너에서 미실행**.
- 중요: #239가 해결하는 것은 **잠정원장 명세 경계 한 가지**뿐이다. #237에 여전히 우선 정책 미제공 `covered`/검토 0, 비정상 금액 `SyntaxError`, 과도한 입력 기간 반복의 자원 고갈 위험이 남는다. #194/#203/#43/#229 등과 단계별 통합검토 필요. 법률 적합성/변호사 인가 판단 자동규칙으로 적용 금지.

## 3. 저장·계산·서식 계약 재독 (정적 범위)

- `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` 실제 JSON 파싱: **18 계산 모듈, 91 입력 선언(고유 78), 42 출력 선언(고유 40), resultPaths 42(고유 42)**.
- `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687` 실제 JSON 파싱: D5103 **37**, D5106 **48**, D5110 **55**, D5111 **82** 토큰.
- Migration 0011/feature store 저장형식·status 코드 재독. 이번 회차 **실제 SQL INSERT/SELECT, 18 계산모듈 전체 호출, Fact→typed→D1, 실제 DOCX 파일 생성/재독은 미실행**. 각 데이터 상태 `미관찰/null/실제0/비해당/conflict/source-only/provisional/사람 승인전`을 합치지 않는다. 단순 V8 합성 통과/코드 존재는 제품 인수 증명이 아님.

## 4. 공식 출처 / 시행일 (재확인 경계)

- **서울회생법원** 2026-10-01 [공식 보도자료](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187): 실무준칙 제424호 제2조 제2항 제7호 신설 공지 **이번 회차 직접 재조회**. 개정전문 PDF의 2026-09-23 개정 / 2026-10-01 시행 / 시행 후 최초 접수 사건 적용은 **r120/r125 직접 재독 영수증에서 인계**했으며 이번 회차 PDF 이미지는 재열람 성공하지 못함. 사건별 법원 최초접수증·관할·Fact·사람 승인 미확인, 자동 단축기간 적용 금지.
- 국가법령정보센터 [제611조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1028276221)·[제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759) **[시행 2026-10-02, 법률 제21490호] 이번 직접 열람**. 제611조의 기본 3년/특별사정 5년과 제614조의 공정·형평·수행가능·청산가치 비교는 숫자 `reconciled`과 별개의 법원 심사사항이다. 48/60개월 자체를 코드에서 임의로 불법/적법 판정하지 않음.
- 국세청 [VAT 공식 안내](https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=239004&mi=40574) 이번 조회: 일반과세자 6개월, 간이과세자 원칙 1년. VAT/종합소득세 신고자료는 승인 월순소득과 구분하며 이번 회차 월소득 산식 본체는 재실행하지 않음.

## 5. 중앙 보드 ID별 부분 결론 ([ ] 유지)

- **A2-LAW-014**: 36/48/60 개월 산술 관찰 및 제611조 시행판 확인; 실제 특별사정/제424호 최초 접수 Fact·법원 적용 미인증.
- **A2-LAW-018**: 우선채권 정책 미제공 36/48/60 `covered`+검토 과제 0 관찰; 제614조 인가요건 자동 승격 금지, 실제 우선분류 미인증.
- **A2-LAW-022**: provisional→reconciled false-positive 3/3 main/#237; #239 가상패치 V8 12/12 조건, Node/상위 문서/CI/전문가 미승인.
- **A2-LAW-024**: 비정상 원화 `1,20` BigInt 예외 3/3 main/#237; null/0/conflict/비해당 상태와 실제 SQL/Word 종단 분리 미완료.
- 모든 항목 **[ ] 부분, 제품 최종 인수 0건**.

## 6. 다음 회차: 데이터담당자

`PlanLedger.status`의 원천·저장·승인 여부, `priorityPolicies` Fact·판본·사람 검토 이력, #237→#239와 #194/#203/#43/#229의 중첩 수정 교차 영향을 우선 확인. 정확한 엔진 Node/타입검증·실제 SQL 및 D5110/D5111 DOCX round-trip을 분리 검증해야 한다.

CI, staging D1/R2/Cron, Word 법원 공식 서식 동등성·법률/회계/변호사 승인, 사이트 배포·운영 DB migration·전자제출·법원 인가 확정 **모두 미실행/미인증**. 고객자료·실 OCR·키·env 저장 없음.
