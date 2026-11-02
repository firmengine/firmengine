# FirmEngine A2 r78 — 변호사 관점 / 검토완료 변제원장의 원천 채권 ID 충돌

- 감사 시점: **2026-11-02 18:23 KST** / 대상: `firmengine/firmengine` main, 변경 허용 범위 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래만.
- 6역할 순환: r77 계산사무장 → **r78 변호사** → r79 데이터담당자.
- 시작 main SHA: `4bbfbf233ce8767b36841e9c08ff0c9a824410d6` (GitHub `fetch_commit(main)`, A3 보드 관련 최근 커밋). 이전 영수증 `r77_1720KST_calc-duplicate-debt-id-conservation.md` 및 Draft #182를 읽고 계속.
- 기존 Draft #182(스택 #178/#175/#173/#172/#168) base blob `lib/repayment-plan-model.ts=9785931fa09f2c0454beb52814c713ff92b41e5d`; 현재 main 제품 blob `6b9e53caba3be1eab17373956aa19717cfeec980` (미병합).
- 추가 확인: `lib/domain.ts` blob `39ab41856f6d7a379aca7217d24b28f7f5f7616a`, `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`, `db/schema.ts` blob `933f8686845ac14669312dd21bf85e02c62ed5e6`, r77 Node 테스트 소스, 계약·토큰 JSON 원본과 보드 A2-LAW ID.
- 신규 Draft [PR #183](https://github.com/firmengine/firmengine/pull/183) base #182 branch, **미병합**. 수정 `lib/repayment-plan-model.ts` blob `cc0b064dfcb33a94e26c31428cd6f66c394feb4b` 4줄 및 신규 `tests/a2-r78-law-reviewed-duplicate-debt-id.test.mjs` (15개 실행형 선언, TODO 3건). 프로젝트 Node runner **미실행**.

## 1. 새로 재현한 P1 기술적 무결성 결함

`buildRepaymentPlanModel`은 `new Map(data.debts.map(d=>[d.id,d]))`로 원천 채권을 ID 기준 보관한다. #182는 **자동 생성(default)** 분기에서만 같은 ID를 차단한다. **실무 검토 완료(reviewed=true) 일정**에서는 동일 ID를 가진 서로 다른 채권이 Map에서 덮어써져도 기술 원장 상태가 `complete`가 됐다. 이는 법원 인가가 아니며 내부 데이터 정합성 결함이다.

**실제 합성 입력 타입**: `CaseData.debts: Debt{id, creditor, principal:{amountWon}, interest:{amountWon}, classification, priority, factIds[]}`, `context.paymentSchedule.phases: [{id,firstInstallment,lastInstallment,firstPaymentDate,monthlyAvailableWon,allocations:[{creditorId,principalWon,interestWon}]}]`. `context.planMonths`=36/48/60, `revision=8`; 계산 `caseRevision=8`, 명시적 회생위원보수 `0`원. 동일한 `SYN-D`로 채권 A 원금100/Fact-A, 채권 B 원금300/Fact-B를 각각 부여하고 1개월당 원금 1원 지급하는 검토된 기간으로 구성. 별도 반례는 A/B 원금100/100 동일하되 Fact 소유가 다른 경우.

| 각 기간 36/48/60 × 조건 | 독립 기술 기대 | #182 실제 V8 | #183 실제 V8 | 처리 |
| --- | --- | --- | --- | --- |
| 동일 debt ID, 채권자·잔액 상이 (3건) | blocked, rows=0 | complete | blocked, rows=0 | 수정후 기대 일치 |
| 동일 debt ID, 잔액 같지만 Fact 상이 (3건) | blocked, rows=0 | complete | blocked, rows=0 | 수정후 기대 일치 |
| 고유 debt ID (3건) | complete **기술 상태만** | complete | complete | 기존 동작 유지 |
| 0원 명시 (3건) | 원화0 유지, 기술 complete | complete | complete | 기존 동작 유지 |
| 과거 revision (3건) | blocked | blocked | blocked | 기존 차단 유지 |
| priority 명시 채권, 별도 지급 누락 (3건) | blocked | blocked | blocked | 기존 차단 유지 |
| default 분기의 중복 채권 ID (3건) | blocked | blocked | blocked | r77 차단 회귀 보존 |
| **tax 분류 채권, 지급 일정 없음** (3건) | **법적 분류 검토전 HOLD** | complete | complete | **미수정·미합격** |
| **원천 원금 5원인데 월 1원×36/48/60** (3건) | **초과지급 여부 검토 HOLD** | complete | complete | **미수정·미합격** |

**실행경로와 검증정도**: GitHub PR #182의 실제 전체 `repayment-plan-model.ts` 코드에서 TypeScript 타입선언만 제거해 V8 `new Function`으로 실행, `moneyValue`만 합성 테스트용 단순 adapter로 대체. 같은 방식으로 새 PR 코드 재실행. 총 **27건 관찰**, 독립 기술 기대가 확정된 **21/21 기대 일치**; **중복 6건 complete→blocked**. 나머지 **6건은 미해결/미판정**이며 27/27 통과로 표시하지 않는다. 이는 원본 Node/TS 모듈 import·프로젝트 전체 기능·DB·DOCX 통합시험 아님.

고유 채권의 직접 산술: 월 1원 × 36/48/60개월 = 각각 **36/48/60원** (회생위원보수 0원). 0원 명시값은 0원으로 남는다. **미관찰(null), 비해당, 원문만(source-only), 상충, 승인전 상태는 이 0원 대조로 승인된 것이 아니다.** A2 급여/사업 월별 합산·VAT/종소세 중복, 재산/청산가치, SQL `source_fact_ids_json`, 실제 18개 계산·91입력·42출력, 서식 재독은 이번 회차 **미실행**.

## 2. 기술 수정·별도 법률 검토 경계

- [Draft #183](https://github.com/firmengine/firmengine/pull/183): **reviewed schedule 경로에만** `Set(debt.id).size!==debts.length` 차단 추가, `REVIEWED_DUPLICATE_SOURCE_DEBT_ID`, 반환 `{status:'blocked',rows:[],issues:[...]}`.
- 금액 재분배, 채권 분류, 우선·재단채권 법적 인정, 변제기간, 계산식, 공식 서식, 승인·제출 정책 **무변경**. #182에 스택되어 있어 부모 PR 병합/CI 없이 main에 직접 병합 금지.
- 후속 **P1 후보/법률 HOLD**: reviewed 경로에서 `classification='tax'`는 row 생성시 priority로 분류하나 `hasPriority`의 누락검사 조건에서 제외 → 세금채권 무지급이 technical complete. 별개 source principal 5원 vs 총 지급 36/48/60원도 음수로 내리지 않고 잔액을 0에 고정하여 complete. **실무자 분류/계산 의미 검토 전 자동 수정하지 않음.**

## 3. 정적 계약 재독 및 공식 원문 경계

- main `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`: **18모듈, 입력선언 91(고유78), 출력선언 42(고유40), 저장경로 42(고유42)**, 정적 파싱만.
- main `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687` 및 `public/templates/catalog.json` blob `9bae52fdf47fbc0935314bb5267503e4182080bd`: D5103 **37/35**, D5110 **55/53**, D5111 **82/80** 등록/공개 매핑 토큰, `reviewer_pending`. 실제 DOCX 출력·재독/공식서식 동등성 **미인증**.
- 서울회생법원(서울 관할) **2026-10-01 공식 보도자료**: 실무준칙 제424호 제2조 제2항 **제7호 신설** https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187 ; 첨부 개정전문/부칙/경과조치와 사건별 적용일 **미확인**, 공지일을 효력일로 가정하지 않음.
- 국가법령정보센터 **[시행 2026-10-02, 법률 제21490호, 2026-03-24 타법개정]** 제611조: https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR . 제614조: https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR . 법원·신청일·인가일별 적용법 검토와 변호사 승인 **미인증**. 36/48/60 산술기간은 법적 인정기간 자동 판정 아님.
- 국세청 공식 부가가치세: https://i.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2401 (일반과세자 6개월, 간이과세자 통상 1년, 전환 등 예외). 신고매출/종합소득세를 인정 월순소득으로 무승인 합산하지 않음.

## 4. ID, 테스트/배포의 구분, 후속

| 보드 체크 ID | 이번 실제 관찰 | 인수 상태 |
| --- | --- | --- |
| **A2-LAW-007** | priority와 tax 형식 검증 차이: tax 무일정 3건 technical complete. 법률검토 전 HOLD | [ ] 부분 |
| **A2-LAW-014** | 36/48/60개월 각 월 1원 합계 36/48/60원, 시행판 기간은 법률상 승인과 별도 | [ ] 부분 |
| **A2-LAW-015** | 2026-10-01 제424호 제7호 공지/2026-10-02 법 시행판 원문 확인, 경과조치 미확인 | [ ] 부분 |
| **A2-LAW-018** | reviewed 중복 채권 6건 technical complete 허위상태 → Draft #183 blocked, 수행가능성 인가 미인증 | [ ] 부분 |
| **A2-LAW-022** | 법적 미확정치의 ledger complete와 법원 승인 분리. 원금 초과지급 3건 HOLD | [ ] 부분 |

**실행한 것**: 연결 GitHub 소스/보드/PR/스키마/합성 V8 27건(명시 기대 21건), 기준정보 JSON 정적 파싱, 공식 법령·법원 HTML·국세청 웹 조회, 별도 Draft #183 코드 및 회귀시험 15개 선언/3 TODO 작성, 변경범위 2파일 재확인.

**실행하지 않은 것**: 신규 Node 테스트 실행, 전체 CI, 실제 원문→Fact→typed→SQL 재저장/재조회, staging D1/R2/Cron, 18모듈 91입력 전체 실행/42출력 재계산, D5103/5110/5111 실제 Word 바이트 생성·재독, 법원 공식 서식, 변호사·서류/계산사무장 최종 검토, 운영배포·D1 운영마이그레이션·전자제출·인가확정. **제품 인수 통과 0건**, 고위험 자동규칙 승격 0건.

**r79 데이터담당자 다음**: (1) #183/#182 부모 스택 및 SQL `source_fact_ids_json`→원장 `sourceIds` 실제 관계와 사건별 유일성, (2) reviewed 세금채권 무지급의 채권분류·우선순위 법률확인, (3) 원금 초과 월별 배분 합과 balanceAfter clamp 관계, (4) 신규 Node 테스트/전체 CI, D5110/11 실제 서식·승인 게이트 E2E.
