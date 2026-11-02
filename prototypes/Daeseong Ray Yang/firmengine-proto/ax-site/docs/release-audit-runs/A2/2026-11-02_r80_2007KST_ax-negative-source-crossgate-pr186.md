# FirmEngine A2 r80 — AX담당자: 음수 원천 채권과 계산·최종문서 게이트 분리 감사

- 기록일: 2026-11-02 KST. 순환: r79 데이터담당자 → **r80 AX담당자** → r81 IT담당자.
- 허용 변경 범위: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 하위만. 고객 데이터/원본 OCR/.env/키/비공개 정답 없음; 입력은 모두 합성.
- 감사 시작·Draft PR 작성 전 **main HEAD**: `b21066f614bd4ffc69aac1cf34c573e5ddbdac81`. 최초 중앙 보드 blob: `badaa06753433354c07bb889bead88981c08a7df`. r79 영수증 및 #185 metadata, 최근 main 커밋·A2 PR 목록 재조회.
- main 소스 blob: `lib/domain.ts` `39ab41856f6d7a379aca7217d24b28f7f5f7616a`; `lib/repayment-plan-model.ts` `6b9e53caba3be1eab17373956aa19717cfeec980`; `lib/plan-reconciliation.ts` `1c895fd2fd8a133368315532ed2ab9984d64b2e3`; `lib/case-execution.ts` `752049c087cc28b2d713eafb5dc3f7294623e8ae`; `lib/office-writer.ts` `78c351a0d7ef8432c24f5c4a7ba9cff0410a8568`; `lib/form-mapping.ts` `514bb4ad0e7ca064812fa7ed3eec55f7041d8d1e`; `lib/case-calculation-feature-store.ts` `bb5f88b26e68f5ae2234741063ac9301a927e27a`.
- 비교한 #185 ledger blob: `f602dcb61a001b8648568af1c92ee0da7ee5d32e`; r79 부모 PR HEAD `079de014f1f54faee2553ec3309a8d3940aeeb64`. 제품 메인 병합 없음.

## 1. 실제 합성 입력·독립 기대·관찰 (계산 판본 명시)

`normalizeMoney`, `moneyValue`, `buildRepaymentPlanModel`은 **GitHub의 실제 함수 본문**을 읽고 TypeScript 타입 구문만 제거한 V8 격리 실행으로 테스트했다. 외부 API, Node 모듈 로더, 프로젝트 테스트 러너를 호출한 E2E가 아니다.

합성 사건 revision 8, 검토된 지급일정, ordinary 채권 SYN-DEBT-A, 원금 `100`원/이자 **명시적 0원**, source Fact `SYN-FACT-A`, 월 1원씩 36/48/60개월; 기준일 `2026-12-31`; calculation revision 8. 독립 BigInt 산술: 지급 총액 각각 **36/48/60원**, 원금 잔액 각각 **64/52/40원**. 별도 사례에서 `normalizeMoney("-5")` 원금 또는 `normalizeMoney("-1")` 이자는 **exact 음수 BigInt**이고 미관찰/null도 0원도 아니다.

- r80 1차 **main 및 #185 각 39건**: 3기간×13합성 조건을 동일 함수 본문으로 반복. main은 complete 36/blocked 3; #185 부모 수정 후 complete 24/blocked 15. 부모 PR에서 null·잘못된 원화·동일 채권 ID 등에 대한 조기 차단이 보강됐지만 #185는 **음수 원금/이자 6건 모두 ledger `complete` 오판**.
- r80 기술 오라클 **3기간×9종=27건/버전**: 정상/명시적 0/null 원금/null 이자/invalid 원금/중복 채권/음수 원금/음수 이자 등을 비교. #185 **21/27** 기대 일치, 수정후 격리 함수 **27/27**. 신규 여섯 사례는 `REVIEWED_SOURCE_DEBT_COMPONENT_NEGATIVE`, `rows=[]`, `blocked`. 기존 명시적 0원은 계속 0원으로 보존하고, null·invalid는 `REVIEWED_SOURCE_DEBT_COMPONENT_UNRESOLVED`.
- r80 **실제 함수 결합 V8 24건**: #185 ledger + **main `reconcilePlanLedger`**를 36/48/60개월×8경계 입력에 실행. 원금 5원/36·48·60원 배분은 ledger 단독 `complete`이나 **reconciliation `blocked`/`PAYMENT_EXCEEDS_CLAIM`** (초과 31/43/55원). 음수 원금은 ledger 단독 complete이나 reconciliation `blocked`/`CLAIM_BALANCE_MISSING`. 월한도 0원 대비 매월 1원 지출은 `MONTHLY_BUDGET_EXCEEDED`로 reconciliation blocked. `calculation.planTotalWon=0` vs 실제 36원 배분 시 reconciliation 자체는 `reconciled`이나 **`legalReviewTasks:["ORDINARY_ALLOCATION_UNRESOLVED"]`**. 세금 채권 분류 `tax`·우선순위 `ordinary`에 별도 지급이 없는 예시에서는 `priorityCoverage={}`; 이는 법률상 HOLD이며 자동 수정 금지. 빈 Fact ID 배열도 ledger/reconciliation 단독 모두 정상 기술상태여서 실제 소유관계 미확인.
- **중요 게이트 분리**: 위 ledger `complete`는 최종 승인/서식 통과가 아니다. `lib/case-execution.ts`의 `planBlockers` 및 `lib/office-writer.ts`의 `planIssues`에는 `reconciliation.legalReviewTasks`가 포함되어 final 문서 생성을 보류하는 조건이 있음(정적 소스 재독). `form-mapping.ts` 개별 `monthly_payment`는 `ledger.status`/reconciliation.status를 보지만 승인된 Fact 소유관계까지 독립 보증하지 않는다. 실제 Office writer·DOCX 생성/바이트 재독은 **미실행**. 원장 local false-complete를 최종 전자제출 허위 통과로 과장 금지.

## 2. 수정·테스트·GitHub Draft (운영/법률 변경 없음)

- **Draft PR [#186](https://github.com/firmengine/firmengine/pull/186)** — 부모 Draft [#185](https://github.com/firmengine/firmengine/pull/185)의 HEAD에서 새 브랜치 `audit/a2-r80-ax-reviewed-negative-20261102-2007`를 생성. base는 #185 작업 브랜치, main 제품 코드 **미변경**. PR은 Draft·미병합/부모 병합 의존.
- 정확히 2파일만 변경: `lib/repayment-plan-model.ts`에 reviewed source principal/interest의 `moneyValue<0n`만 검사하는 작은 선행 가드; 신규 `tests/a2-r80-ax-reviewed-negative-components.test.mjs` 합성 36·48·60개월 **Node test 그룹 21개 + TODO 3건** 작성/커밋. 실제 **프로젝트 Node runner/CI에서 아직 실행하지 않았음**. V8 수정후 27/27은 위 별도 격리 실행 결과.
- 제품 수정 커밋 `2031ab8b1208a7dfcb7bcb7fc528e23246a61e7a`, 수정 blob `9ee87047a029108f665c72ae6c0241942d7b28b1`; 시험 추가 후 PR HEAD `3b38e1e2576628f126f1e5a92b75dc84f8a418e5`. 업데이트 직전 #185 HEAD와 대상 blob SHA 대조 후 작성, 이후 compare에서 차이 파일 2개 모두 prefix 내부 확인. 금액 산식, 채권 분류, 지급액, 법률/과세 규칙 변경 없음.
- 신규 테스트 파일은 JavaScript import 줄을 제외한 구문 파싱만 성공. 이것은 import 로드, TypeScript 실제 빌드, 테스트 실행 성공이 아님.

## 3. 저장 형식·정적 계약·독립 산술

- migration `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`의 3 CREATE TABLE+2 INDEX와 합성 `cases` parent를 **Python SQLite 3.46.1 메모리 DB**에서 실행, `PRAGMA foreign_keys=ON`. **합성 9/9 저장·SELECT 재독 성공, FK 위반 0**. 명시적 0(`value_json="0"`, `value_won="0"`), SQL null+missing, source-only 역할 표기, conflict 상태를 구별하여 저장. 동시에 음수 `"-5"` 상태 computed, 미존재 Fact ID, 같은 ID 중복, 잘못된 JSON, `value_json=50`/원화열 70 상충이 DB에서 **허용됨**. SQL 저장 성공은 사실성·동일 사건 Fact FK·법률 승인 증거 아님. 실제 D1/앱 API 왕복 **미실행**.
- main `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` 직접 JSON 파싱: **18 계산 모듈, 91 입력 선언(고유 78), 42 출력 선언(고유 이름 40), 42 resultPaths(고유 42)**. 전체 계산 18개 실행/91입력·42출력 산술 replay는 미완료.
- main `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687` 직접 JSON 파싱: **D5103=37, D5110=55, D5111=82 등록 토큰**. r79 이전 공개 매핑의 35/53/80 및 `reviewer_pending`은 기존 영수증 기록이며 이 회차 공개 매핑 파일 직접 재파싱은 미완료. 실제 Office/DOCX·공식서식 동등성 미관찰.
- 참고 독립 산술: 급여 12×2,400,000=**28,800,000원**, 사업 월순소득 **관측 11×1,000,000=11,000,000원**, 관측 합계 **39,800,000원**. 사업 미관찰 12월은 0원/승인소득으로 보간 금지. VAT 신고매출/종합소득세 신고금액을 해당 월순소득에 자동 더하지 않음. 이는 합성산술이지 18모듈 실행 결과가 아님.

## 4. 공식 출처·법원/시행일·자동규칙 금지

- **서울회생법원 2026-10-01** [실무준칙 제424호 제2조 제2항 제7호 신설 공식 공지](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187). 해당 공지 HTML은 확인. 첨부 개정전문 PDF의 부칙·경과조치, 사건별 적용/효력일은 **미확인**. 공지일을 법률상 자동 적용일로 승격 금지.
- **국가법령정보센터**, `채무자 회생 및 파산에 관한 법률`, **법률 제21490호 [시행 2026-10-02]** [제611조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0611&lsiSeq=290631&urlMode=lsScJoRltInfoR) 및 [제614조](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0614&lsiSeq=290631&urlMode=lsScJoRltInfoR) 원문. 기간·우선채권·인가 판단은 내부 기술 게이트와 별개; 사건별 관할·접수일·법률 적용 경과조치 및 변호사 확인 전 **미인증**.
- **국세청** [부가가치세 개요 공식 안내](https://i.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2401): 일반과세자 6개월 과세기간, 간이과세자는 통상 1년(유형전환 예외 유의). 신고매출·납부 VAT와 법원 인정 월순소득 자동 합산·변환 금지.

## 5. A2 보드 ID (완료 체크 [x] 0건; 모두 [ ] 유지)

| ID | 이번 실제 관찰 | 상태 |
| --- | --- | --- |
| **A2-AX-004** | real normalizeMoney/moneyValue + null/0/음수, SQLite stored status/null/unknown 구분; 전체 AI→typed→DB E2E 안함 | 부분 [ ] |
| **A2-AX-015** | 36/48/60, GitHub 원본 V8 39×2 + 독립오라클 27×2 + ledger/reconciliation 24건, 수정 가드 27/27 | 부분 [ ] |
| **A2-AX-017** | ledger complete ≠ reconciliation reconciled ≠ legal approval; case-execution/office-writer final preflight 정적 재독, 전문가 승인 미완 | 부분 [ ] |
| **A2-AX-018** | 메인/PR SHA·원천·합성 입력/예상/실측·수정/테스트 미실행 경계를 영수증으로 기록 | 부분 [ ] |

**최종 인수 완료 0건.** #186의 Node test와 전체 CI·18모듈/91입력·42출력 실제 replay, staging D1/R2/Cron, 실제 D5110/D5111 Word 생성·재독, 공식서식 동등성, 변호사/계산사무장 확인, 사이트 배포는 수행하지 않았다. 운영 배포·운영 DB migration·실제 전자제출·법원 인가 확정은 **수행 금지/미실행**.

**다음 r81 IT담당자**: 부모 Draft #185→#186의 Node 테스트 실행 및 CI/컴파일, 원문→Fact→typed→SQL feature `source_fact_ids_json`와 ledger `sourceIds` 동일 사건·동일 producer/시점·revision 검증, `reconciliation.legalReviewTasks`→D5110/11 final writer를 실제 통합시험으로 차단 검증, SQL 멱등성/값-상태 충돌 회귀. 세금채권 분류·원금 초과 지급·미관찰 이자 예외는 변호사·계산사무장 승인 전 계산/법률 의미 변경 금지.
