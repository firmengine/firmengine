# FirmEngine A2 r102 — 변호사 축: 우선·세금채권 정책 누락 / 잠정원장 / 무효금액 cross-gate 독립감사

- 실행일: **2026-11-03 KST**, 이전 **r101 계산사무장**, 이번 **r102 변호사**, 다음 **r103 데이터담당자**. 범위는 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래 파일만.
- 작업 시작 main HEAD: `b3236df4872f333d8abbf0c5d546b640a19f36b3`; 쓰기 직전 main HEAD: `b3236df4872f333d8abbf0c5d546b640a19f36b3`. 중앙 보드 [`docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md`](../../PRODUCT_RELEASE_INTEGRATION_BOARD.md) ID **A2-LAW-007 / 018 / 022 / 024**를 검토하며 **전부 [ ] 유지**.
- 원본: main `lib/plan-reconciliation.ts` blob `1c895fd2fd8a133368315532ed2ab9984d64b2e3`; Draft [#194](https://github.com/firmengine/firmengine/pull/194) blob `2a3645defb2b613da68f3a9044f149713925fd4e` (head `14752a28f63e22805bbb35321cf873f52878e960`); Draft [#203](https://github.com/firmengine/firmengine/pull/203) blob `fcefc9239808c9c1356b6eb4bc438efe5ac51bf9` (head `e2c443554388548da3adec9032682783eabdc7f7`). 참고 [#192](https://github.com/firmengine/firmengine/pull/192), [#215](https://github.com/firmengine/firmengine/pull/215)과 r101 영수증. #194는 #192 후속 브랜치 위, #203은 main 기반으로 **서로 독립 배포할 수 있는 단일 합본이 아님**.
- 소비처 main 정적 재독: `lib/case-execution.ts` blob `752049c087cc28b2d713eafb5dc3f7294623e8ae`, `lib/office-writer.ts` blob `78c351a0d7ef8432c24f5c4a7ba9cff0410a8568`: `planReconciliation.legalReviewTasks`는 `planValidationApplies` 시 최종 생성 blocker에 포함. 그러나 `planLedger.status === "provisional"` 자체는 기존 코드의 조건문 `status === "blocked"`에 포함되지 않아 독립 점검이 필요. 전체 API/실제 최종 DOCX를 구동했다고 볼 수 없다.
- 관련 테스트 `tests/refactor-calculation-acceptance.test.ts` main blob `0370bbdf4c1af0b192b294b50dd63b679f7a0b01`의 `AT-28/29` 소스 확인; 실제 프로젝트 Node runner는 **미실행**. 지난 r101 수치 오류 예외 기록을 독립적으로 이어 검사.
- 공개 Git에 실제 사건·고객·OCR·원문·비공개 정답/키/.env 없음. 모든 `SYN`은 합성 키이며 SQL에 실제 적재하지 않음.

## 1. 실제 실행 범위와 독립 기대

GitHub에서 확보한 각 판본의 **실제 `reconcilePlanLedger()` 본문**에서 TypeScript 타입 표기만 제거하고 V8 JS 실행. `nat`은 실제 원본문의 `typeof v==="string" && /^\\d+$/.test(v)`와 동일 구현, `moneyValue`는 synthetic `{amountWon:"0"}=>0n`만 사용하는 대역. **main 21 + #194 21 + #203 21 = 실제 원본문 격리 실행 63조건**. 실 D1·R2·Node test/CI·DOCX·법원서식 검증 아님.

모든 합성 조건의 `term = 36 / 48 / 60`. Typed `CaseData` 최소입력 `{context:{planMonths:term, monthlyPriorityPayment:{amountWon:"1"}, monthlyEstatePayment:{amountWon:"0"}, monthlyTrusteeFee:{amountWon:"0"}}, debts:[{id:"SYN",priority:"ordinary|priority",classification:"ordinary|tax",principal:{amountWon:String(term)},interest:{amountWon:"0"}}]}`. `CalculationResult` 대역 `{ordinaryRepaymentBudgetWon:"1|0",monthlyPaymentWon:"1",disposableIncomeWon:"1",planTotalWon:String(term)|"0"}`; `PlanLedger` `{status:"complete|provisional",issues:[],rows:term개의 월별 행}`. 정상 행은 회차 1..term, `debtId:"SYN",principalWon:"1",interestWon:"0",otherComponentWon:"0",balanceAfter:String(term-installment)`; 주어진 시나리오에서 claimClass/funding/status/policy/amount만 1개씩 변형. 명목 독립 기대는 `1n*BigInt(term)` = 36/48/60원, 인정된 채권·시가·법률상 인가액 아님. 원문→Fact→typed→SQL 저장·재독/42출력 경로와 출력 토큰 실제 소비는 **미관찰**.

| 변형 (각 36/48/60에서 1회) | 독립 기술·법률검토 경계 기대 | main 관찰 | #194 관찰 | #203 관찰 |
| --- | --- | --- | --- | --- |
| `ordinary_provisional`: 유효 행, 원장 status=provisional | 잠정 상태는 최종 인수 전 별도 HOLD; 기술합계는 N원 | `reconciled`, issues=[] | 동일 | 동일 |
| `priority_policy_unknown`: 우선채권 N원 전액, applicability=unknown | `priorityCoverage=unknown` 및 검토 과제 (기술 `reconciled` 자체만으로 승인 아님) | `reconciled` + `PRIORITY_COVERAGE_POLICY_REVIEW:SYN` | 동일 | 동일 |
| `priority_policy_missing`: 우선채권 N원 전액, priorityPolicies 미제공 | **명시적인 정책/승인 없음을 법률상 covered로 확정 금지** (계약 추가 검토) | `reconciled`, `covered`, 법률 검토 과제 없음 | 동일 | 동일 |
| `priority_policy_confirmed`: 명시적 confirmed, N원 지급 | 정책 입력 및 산술상 covered (실제 사람 검증은 별개) | `reconciled`, `covered` | 동일 | 동일 |
| `tax_no_pay`: 분류 tax/priority ordinary, priority 행 월 0, 원채권 N | **세금채권 기술적 무지급 커버리지를 차단**; 법률상 우선권 자체는 변호사 판단 | `reconciled`, coverage 없음 | `blocked`, `PRIORITY_ESTATE_NOT_FULLY_PAID_BY_DEADLINE:SYN` | `reconciled`, coverage 없음 |
| `unknown_class`: 미등록 claimClass=other, 매월 1원 | 미등록 원장 분류/재원은 차단, trusteeFee=0 유지 | `reconciled`, `trusteeFeeWon=N` (잘못된 집계) | 동일 | `blocked` (INVALID_LEDGER_CLAIM_CLASS), trusteeFee=0 |
| `bad_amount`: 첫 회 원금 `1,20` | 예외 없이 오류금액 미확정/차단 (0원으로 바꾸지 말 것) | **SyntaxError** | **SyntaxError** | **SyntaxError** |

- **본 회차 실행 63건 중** 정상 3기간×1조건×3판본 = 9건의 명목합계 외, 54건은 상태/오류 경계 테스트이다. 63/63 PASS라고 기록하지 않는다. 결함은 `tax_no_pay` main·#203의 기술 오통과, `unknown_class` main·#194의 잘못된 보수 집계, 3판본 `bad_amount` throw, missing-policy false covered / provisional 기술 reconciled의 **의미론적 위험**이다.
- **중요 보정:** 소비처 `case-execution.ts`와 `office-writer.ts`는 `legalReviewTasks`를 수집하여 최종 게이트에 전달한다. 따라서 priority_unknown의 `status=reconciled`만으로 실제 최종 서식 생성/법원 제출까지 승인됐다고 주장할 수 없다. 반면 missing-policy는 `legalReviewTasks=[]`, provisional은 ledger.status가 차단 조건에 없음: **별도 통합 검증 우선**.

## 2. 법원·시행일·출처: 2026-11-03 재조회

- **서울회생법원**, 2026-10-01 공지 `개인회생 변제기간 단축 대상에 관한 실무준칙 개정`: [공식 HTML](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187), 제424호 제2조제2항제7호 신설 게시. r96 기존 공식 PDF/부칙 감사 기록: **2026-09-23 개정, 2026-10-01 시행, 이후 최초 접수 사건 적용**. 본 회차에서는 **첨부 PDF 원문을 직접 재독하지 않았음**. 사건별 최초접수일/관할과 승인상태는 미인증, 자동규칙 추가 금지.
- **국가법령정보센터**: [채무자회생법 제611조 (2026-10-02 시행 법률 제21490호)](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR). 우선권 있는 개인회생채권/재단채권의 전액 변제 내용, 기본 3년·특별사정 5년 이내. **개별 채권의 우선권 인정은 다른 판단**.
- **국가법령정보센터**: [동법 제614조 (동일 시행판)](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR). 공정·형평·수행가능·인가결정일 기준 청산배당 비교 및 이의 조건이 요구되며, 산술상 `covered`가 자동 인가를 의미하지 않음.
- **국세청** [VAT 과세기간 공식 안내](https://g.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7804&mi=2483): 일반 6개월, 간이 원칙 1년. VAT/종합소득세 신고·급여/사업소득·실제 법원 인정 월소득은 **각각 별도 타입/기간/원천**. 본 회차 월소득 본산식 재실행은 없음.

## 3. 정적 계약 재독 및 보류 결론

main `reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce`를 JSON 실제 파싱: **계산 18모듈, 입력 선언 91회(고유78), 출력 선언 42회(고유40), resultPaths 42**. `template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687` 파싱: D5103 **37**, D5106 **48**, D5110 **55**, D5111 **82**. **정적 목록 집계**일 뿐 산식 전체 호출·실제 SQL 저장·DOCX 바이트 생성/재독 아님.

- **A2-LAW-007 [ ]**: tax/우선권과 분류/재원 변형 대조. `#194` tax 3/3 기술 차단 vs `#203` unknown class 3/3 기술 차단은 독립적이며 서로의 미해결 결함을 가리지 못함. 실제 법적 우선권·납기·이의·별제권 분류 미인증.
- **A2-LAW-018 [ ]**: 제611/614조 우선채권 전액·공정/수행가능성 조건은 개별 인가결정과 분리. priorityPolicies 미제공 시 `covered` 3/3은 **승인 증빙 부족**, 계약 설계/법률 검토 필요.
- **A2-LAW-022 [ ]**: provisional ledger → `reconciled` 3/3; priority_unknown → `reconciled+legalReviewTasks` 3/3. 소비처는 legalReviewTasks를 검사하지만 missing-policy는 검토 과제 없음. 모든 종류의 승인전 상태를 실제 최종 생성 게이트에서 시험해야 함.
- **A2-LAW-024 [ ]**: 잘못된 `1,20` 3기간×3버전 모두 SyntaxError (9/9)로 중단. 미관찰/명시적0/오류형식을 구별하는 fail-closed 반환계약·서식 출력 및 오류 UX 검토 필요.

**수정:** 제품 코드 수정 0, 계산 수치/법률 규칙 자동변경 0, 병합 0. 법률상 우선순위·정책 승인 경계를 자의적으로 강화하면 실제 법원 사건 적용 의미가 변하므로 별도 Draft/IT·계산사무장·변호사 검토 후 수정. 기존 #194·#203·#215와 #192 변경 충돌/합본 테스트 전 병합 보류. 실무자 최종 법률·세무회계 인증 **0건**.

**다음 r103 데이터담당자:** 원문/Fact/typed/SQL feature에서 `debt.classification/priority`, `priorityPolicies`와 승인자·판본·증빙, `planLedger.status`의 소유·원본 값 구분을 실제 스키마에서 검증. #194+#203+#215+원화 형식 방어를 재검증하여 `source-only/null/0/비해당/상충/승인전` 독립 케이스를 36·48·60개월에 연결하고 실제 프로젝트 Node/SQL 스테이징/서식 재독은 별도 영수증으로 남길 것.

**인수/배포:** 최신 main CI, D1/R2/Cron staging, 법원 공식 서식·DOCX, 법률/회계 승인, 운영 배포·D1 운영 마이그레이션·실제 제출·법원 인가 확정 **모두 미실행·미인증**.
