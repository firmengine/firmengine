# FirmEngine A2 r77 — 계산사무장 / 원천 채권 ID 중복에 의한 변제원장 계보 혼동

- 회차: **2026-11-02 17:20 KST**, `firmengine/firmengine`, `main` 대상 파일범위 **`prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 한정**.
- 역할: r76 **사용자·서류담당자** → r77 **계산사무장** → r78 **변호사**.
- 기준 시작 main SHA: `defbf17af203296cf4c8556d45b6359af12bbd3e` (2026-11-02 17:12 KST, GitHub branch API). 영수증 기록 직전 main HEAD: `defbf17af203296cf4c8556d45b6359af12bbd3e`.
- 이전 인수: [r76](2026-11-02_r76_1620KST_doc-filing-visible-marker-parity.md) 및 [r75](2026-11-02_r75_1510KST_it-canonical-factids-sql-provenance.md). 관련 미병합 Draft: #168/#172/#173/#175/#178, 승인 게이트 #165, 서식 #166/#181.
- 스키마/실제 코드 재독: main `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`, `db/schema.ts` `933f8686845ac14669312dd21bf85e02c62ed5e6`, `lib/case-calculation-feature-store.ts` `bb5f88b26e68f5ae2234741063ac9301a927e27a`; PR #178 `lib/repayment-plan-model.ts` blob `0ed5ffc0cce588ed9d8b12a79ea620b54874b5ab`; r75 `tests/a2-r75-it-canonical-factids.test.mjs` blob `33158d161bf5399d172a3d0356b550c90e41a2fb`. #178은 main 미병합; main 제품원본 `repayment-plan-model.ts` blob `6b9e53caba3be1eab17373956aa19717cfeec980`.
- 신규 수정: [Draft PR #182](https://github.com/firmengine/firmengine/pull/182) 는 #178을 base로 하는 별도 branch `audit/a2-r77-calc-duplicate-debt-identity-20261102-1720`. PR branch HEAD `e0d54cbc07d66f2a2e88c6a6cb1e05d015b597a2`. 변경 2파일 모두 범위 내부: `lib/repayment-plan-model.ts` blob `9785931fa09f2c0454beb52814c713ff92b41e5d`, `tests/a2-r77-calc-duplicate-debt-identity.test.mjs` blob `1d6014d6c20f0fb158cf8256f159a6b0d3897d64`.

## 1. 합성 입력·독립 기대·실제 관찰

**원천·typed 구조:** `CaseData.debts`에 `Debt{id,creditor,principal:{amountWon},interest:{amountWon},factIds[]}`; `CalculationResult.allocations`에 `{debtId,allocatedPrincipalWon,allocatedInterestWon,factIds[]}`. 이 입력은 가상이며 실고객 Fact/OCR/개인정보가 아니다. 저장 feature 경로는 SQL `case_calculation_features.value_json,value_won,status,source_fact_ids_json,input_refs_json`이나 **이번 회차 DB insert/replay는 미실행**.

- 정상 합성: 채권자 A / debt `SYN-DEBT-A`, 원천 원금 100원·이자 20원·Fact `FACT-A`; 배분 원금 50원·이자 10원, 총 60원; 사건 revision=8, trustee fee=명시적 0원, 36/48/60개월.
- 중복 반례 1: 두 번째 채권자 B에 **같은 debt ID**, 원금 500원, 다른 Fact `FACT-B`. 독립 기대: `blocked`/생성행 0 (서로 다른 원천 채권자가 동일 ID를 점유하면 어느 Fact의 배분인지 확정 불가). 기존 #178 `new Map(debts.map(...))`이 B로 덮어쓰고 `provisional`; 36/48/60 **3/3 허위 provisional**.
- 중복 반례 2: 두 채권자의 원금은 모두 100원이나 Fact `FACT-A` vs `FACT-B`, ID만 동일. 독립 기대: `blocked`/0행. 기존 #178 `provisional`; 36/48/60 **3/3 허위 provisional**.
- 신규 코드: default 분기에서 `new Set(data.debts.map(debt=>debt.id)).size!==data.debts.length`면 `status=blocked, rows=[], issues=["DEFAULT_DUPLICATE_SOURCE_DEBT_ID"]`. 기존 금액을 변경/자동 재배분하지 않는다. **법적 중복채권 인정·제외 규칙은 변경하지 않는다.**

**실제 실행 위치 및 범위:** GitHub #178 원본 default 함수 분기의 본문을 가져와 TS 주석형 타입만 제거하여 V8 `new Function`으로 실행하고, `moneyValue`의 원화 판독 및 정렬·0원 회생위원보수 보조함수를 합성 격리 대체했다. 원본 전체 Node 테스트 러너와 DI/DB/서식 연결은 아니다.

| 36/48/60개월 × 합성 조건 | 독립 기대 | 기존 #178 실제 | 신규 #182 실제 |
| --- | --- | --- | --- |
| 각 2종 중복 채권 ID × 3기간, **6건** | blocked | **6건 provisional 오판** | **6건 blocked** |
| 단일 고유채권 × 3기간 | provisional | provisional | provisional |
| 명시적 0원 × 3기간 | provisional, 총0원 | provisional | provisional |
| 이자 null × 3기간 | blocked | blocked | blocked |
| 계산 caseRevision 불일치 × 3기간 | blocked | blocked | blocked |
| 공백 Fact ID × 3기간 | blocked | blocked | blocked |
| 빈 Fact ID 목록 × 3기간 | **소유·실재 확인 전 미판정** | provisional 관찰 | provisional 관찰(미수정) |

기대가 정의된 21건의 신규 후보 **21/21 기대일치**. 빈 Fact 배열 3건은 기대 통과 건수에서 제외하고 법률·원천 계보 미검증으로 유지. 원래 #178 오류는 중복 6/6. #182 신규 Node 실행형 21건 + TODO 3개는 **작성·커밋했으나 프로젝트 Node 러너로 실행하지 않았다**.

**독립 산술 (원화 BigInt 분배):** 배분 원금 50 + 이자 10 = 총 60원. 별도 실제 신규 함수 분기 평가에서 36/48/60개월 각각 일반채권 행 36/48/60개; 관측 원금 합 **50원**, 이자 합 **10원**, 총 **60원**. 월별 최대 지급은 순서대로 **3/3/2원**이며 월 제안상한 10원을 넘지 않았다. 이는 법원 인가 가능성을 의미하지 않는다. 0원/null/상충/비해당/source-only/승인전은 서로 자동 대체하지 않는다.

## 2. 계산·서식 계약 정적 재독 (main)

- `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: 계산모듈 **18**, 입력 선언 **91**(고유78), 출력 선언 **42**(고유40), 저장 결과경로 **42**(고유42). 입력 91개 실제 계산 전수 실행은 미실시.
- `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`와 `public/templates/catalog.json` blob `9bae52fdf47fbc0935314bb5267503e4182080bd`: D5103 등록/공개매핑 **37/35**, D5110 **55/53**, D5111 **82/80**. 차이 토큰 각 `review_status`, `revision`; 세 형식 `reviewer_pending`.
- 별도 합성 월소득 참조점: 근로 2,400,000원 × 관측 12 = 28,800,000원, 사업 관측 1,000,000원 × 11 = 11,000,000원, **관측 합계 39,800,000원**. 사업 미래 12월 **null/미관찰**이고 0원으로 보간하지 않음; VAT/종소세 `source-only`는 합산하지 않음. **r77에서 이 소득 경로의 새 함수 실행은 하지 않았다.**
- 18모듈×91입력, SQL feature 재조회, 실제 DOCX 생성·ZIP 재독, 공식 원본 서식 동등성, 전체 CI, staging D1/R2/Cron **미실행**.

## 3. 2026-11-02 공식 법령·법원·국세청 확인과 법률 경계

1. **서울회생법원** 2026-10-01 보도자료 `개인회생 변제기간 단축 대상에 관한 실무준칙 개정`, 실무준칙 제424호 제2조 제2항 **제7호 신설**. https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187 . 첨부 전문·부칙/경과조치와 **개별 사건에 적용되는 날짜 미확인**; 공지일만으로 자동규칙 승인하지 않는다.
2. 국가법령정보센터 **[시행 2026-10-02, 법률 제21490호]** 제611조: 변제계획 내용/우선·재단채권과 원칙 3년·예외 5년. https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR .
3. 같은 시행판 제614조: 공정·형평·수행가능성, 비용, 청산가치 비교 및 이의 시 추가조건. https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR .
4. 국세청 부가가치세 안내 https://i.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2401 : 일반 과세기간 보통 6개월, 간이 1년, 전환/예정신고 예외. 신고액은 사업 인정 월순소득에 무승인 합산하지 않는다.

**법원·사건별 시행판 적용, 세무 회계 적합성, 법률 인가·채권 분류·배분 의미**는 최종 계산사무장·변호사 및 서류 담당자 실무 검토 전 **미인증**. 사람 승인 없이 법률상 확정값으로 승격 금지.

## 4. 보드 ID 현황 및 후속

| ID | 이번 관찰 | 상태 |
| --- | --- | --- |
| A2-CALC-019 | 원천 원금/이자 Fact는 별개인데 같은 debtId는 Map에서 충돌; 36/48/60합성 재현 | **[ ] 부분** |
| A2-CALC-020 | 서로 다른 채권자의 같은 debtId가 한 채권으로 침묵 덮어쓰기; Draft #182 최소 차단 | **[ ] 부분** |
| A2-CALC-026 | 36/48/60 개월 BigInt 50/10원 분할·월 최대 3/3/2원, 종료개월 및 서식 실제 미실행 | **[ ] 부분** |
| A2-CALC-030 | 0/null/ID중복/참조판본 stale/Fact 공백 21건 V8 기대 대조, SQL/CI 미실행 | **[ ] 부분** |

**다음 r78 변호사 관점:** #182/#178/#175/#173/#172/#168 스택의 변경 연결/실제 Node 테스트를 확인하고 원천 채권 ID 유일성의 사건 생성·서류 분류 단계 보장 여부, 빈/외부 Fact ID 존재·소유, 합산 이중계상/우선재단 별도일정 및 변제 인가요건을 독립 검토. #165/#166/#181의 승인/서식 게이트 실물 DOCX 검증 필요. Draft #182 병합·배포 금지(실무검토·실제 runner/CI 미인증). 최종 제품 인수 완료 **0건**. 실제 운영 배포·운영 DB migration·전자제출·법원 인가 확정 **모두 실행하지 않음**.
