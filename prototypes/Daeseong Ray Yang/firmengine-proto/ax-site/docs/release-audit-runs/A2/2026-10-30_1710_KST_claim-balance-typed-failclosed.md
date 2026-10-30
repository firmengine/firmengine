# FirmEngine A2 5차 — 채권 원금·이자 결측의 0원 대체/위조 정규화·BigInt 예외 차단 (2026-10-30 17:10 KST 시작)

## 실행 범위와 변경 충돌 확인
- 저장소: `firmengine/firmengine`; **수정 경로**: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 아래만.
- 시작 HEAD: `a096f421f24c4938b409d27ad3a5a97259336826`; 감사 기록 작성 전 최신 main HEAD: `a096f421f24c4938b409d27ad3a5a97259336826`.
- 읽은 인계: [A2 4차](2026-10-30_1617_KST_phase_month_end_and_won_remainder.md) 및 `docs/PRODUCT_RELEASE_INTEGRATION_BOARD.md` (A2-IDs), `lib/repayment-plan-model.ts`, `lib/plan-reconciliation.ts`, `lib/domain.ts`, `lib/case-calculation-feature-store.ts`, `lib/case-execution.ts`, `lib/reference-decision-tables.json`, `lib/form-mapping.ts`, `lib/document-preflight.ts`, `db/schema.ts`, `tests/repayment-plan-model.test.ts`, `tests/calculation-18-output-golden.test.ts`, `tests/case-calculation-feature-store.test.ts`, `lib/preapproval-calculation-replay.ts`. 최근 커밋 A1/A3/A4와 open Draft PR #13/#18/#21/#25/#28 등 확인.
- 이번 **5개 체크·5역할**: `A2-LAW-021`(법/관할/시행판본), `A2-DATA-017`(저장 경로 replay), `A2-IT-015`(DB typed round-trip), `A2-CALC-026`(36/48/60회·원금 잔액·월 예산), `A2-DOC-005`(D5110 표시). 모두 **[ ] 유지·부분검증**. A2 4차의 계산·서류·데이터·IT·AX 이후 변호사 검토를 우선 배치.

## 1. 발견한 신규 P1 코드 결함 — 실제 근거 없는 '0원 잔액'과 예외 중단

**실제 main 함수/위치:** `lib/repayment-plan-model.ts`의 `buildRepaymentPlanModel`, 자동생성/수동 승인 일정 두 경로 모두 초깃값에 `BigInt(d.principal?.amountWon??"0") + BigInt(d.interest?.amountWon??"0")` 사용. main blob SHA `6b9e53caba3be1eab17373956aa19717cfeec980`.

- **합성 입력/저장 타입:** `Debt.principal/interest: NumericInput | null`(`rawValue`, `amountWon`, `unit`, `currency`, `normalizationStatus`)에 `null`, 잘못된 typed 숫자, raw/typed 불일치, 음수, 명시적 0원 값을 주입. `data.context.paymentSchedule`의 `reviewed:true`, `planMonths:2`, `monthlyAvailableWon:"1"`, `phase.allocations: [{creditorId:"d", principalWon:"1", interestWon:"0"}]`; 다른 유형은 자동생성 36·48·60개월.
- **독립 기대:** 원금/이자가 `null`이거나 무효/상충/음수이면 법원 인정 0원으로 보지 않고 ledger `blocked`, `rows:[]`, 원인 `CLAIM_BALANCE_MISSING:d`. 실제 0원은 결측과 구별하고 기존 정상/거액 정수 결과 유지.
- **기존 main 실제 원본 함수 격리 관찰:** 수동 검토 일정에서 원금 또는 이자 `null` → `status:"complete",issues:[],rows:4`; 정규화 원문 `"2"`를 수치 `"9"`로 바꾼 경우에도 `complete`; `bad/oops` 입력은 `Cannot convert ... to a BigInt` 예외. 자동 생성에서 누락 원금/이자 36/48회도 `provisional` 행을 생성.
- **새 수정:** 기존 `domain.moneyValue`로 입력 raw/typed/단위/통화와 정수 표현을 재검증하고, `null`, 오인식, 상충, 음수는 **초기 잔액 산술 이전** 차단. 정상 0원은 허용. `CLAIM_BALANCE_MISSING:<debtId>` 명시 오류 후 종료하며 직원 검토나 법원 확정으로 표시하지 않음.
- **격리 재현 방법:** GitHub에서 읽은 **실제** `repayment-plan-model.ts` 함수 본문과 `domain.ts`의 실제 `normalizeMoney/moneyValue` 본문에 TypeScript 타입 표기만 제거하여 JS V8 `new Function`으로 직접 실행. 기존 main과 수정된 branch 비교. **수정 후 15/15 기대 판정 일치**: reviewed null principal/interest, malformed principal/interest, raw 값과 `amountWon` 위조, negative interest, 36/48/60회 generated null/invalid, 정상 reviewed, 명시 0원, 정상 36/48/60회, `9007199254740993`원 BigInt(48개월). 이는 타입 제거된 격리 함수 실행이며 **Node 정식 테스트 파일 실행이나 실제 Cloudflare D1이 아니다**.
- **수정 파일:** `lib/repayment-plan-model.ts`; 신규 `tests/a2-claim-balance-failclosed.test.ts` (Node 테스트 9개 선언, 저장만 완료). 두 파일만 Draft [PR #29](https://github.com/firmengine/firmengine/pull/29) / 브랜치 `audit/a2-claim-balance-nonzero-failclosed-20261030-1710` (마지막 코드·테스트 commit `2b6b76c7250d1eee9bc02c7f8bd10cfbad3b800a`). **main 미병합**.
- **중요 병합 충돌:** [Draft PR #25](https://github.com/firmengine/firmengine/pull/25)는 **동일 파일** `repayment-plan-model.ts`의 월말 날짜(anchor) 수정 중. 결합할 때 2PR 격리/Node/서식 E2E를 동시 수행해야 한다. 절대로 PR #25의 날짜수정을 덮어쓰면 안 됨.

## 2. A2-CALC-026 — 월별 예산을 넘는 나머지원 반례 실 코드 격리 재검사
- 합성 원금 10원짜리 채권 2개, 각 3회 분할: 독립 원단위 배분은 각각 `[4,3,3]`, 월별 총 `[8,6,6]`(합계 20원). 월 한도 7원→1회차 8원 초과.
- `lib/plan-reconciliation.ts`의 **실제 함수**에서 TypeScript 타입만 제거하고 V8 실행: 월별 합계 `[8,6,6]`, `planTotalWon:"20"`, `ordinaryRepaymentBudgetWon:"7"`, `disposableIncomeWon:"7"`, 스케줄 상한 7원 → **`status:"blocked"`**, 이슈 정확히 `CATEGORY_BUDGET_EXCEEDED:1:ordinary`, `MONTHLY_BUDGET_EXCEEDED:1`, `DISPOSABLE_INCOME_BUDGET_EXCEEDED:1`, 총액 20원. 이전 4차에는 코드 분기만 읽었지만 이번엔 해당 함수 본문 실실행으로 차단 확인. 실제 `executeCaseNodes` 전체 및 Word 생성까지의 차단 E2E는 **미실행**.
- 36/48/60회는 이번 ledger 단일 함수 정상 경계만 실행했고 여러 채권/다중 phase 날짜/법원 기간 특례는 미인증. PR #25 미병합.

## 3. A2-DATA-017 / IT-015 — 저장/산식/서식 결과 확인 수준
- 최신 `reference-decision-tables.json` **실제 파싱**: 계산 18모듈, 입력 **91회**, 고유 입력 **78**, 출력 선언 **42**, `resultPaths` **42**. **42개 실제 저장·SQL 재읽기·Word 토큰 전수 성공을 뜻하지 않음**.
- `case-calculation-feature-store.ts`는 `calculationFeatureRows`로 결정론 결과를 저장, `/assessment/calculation/... `, `/proposals/... `, `/courtApprovalInferred` 경로의 하위 값과 금액을 다르게 보존. `preapproval-calculation-replay.ts`가 **전체 execution** 기준 JSON Pointer로 비교한다는 계약 확인. 비저장 거래·처분·서식 모듈 결과를 42 SQL row가 반드시 있어야 한다고 단정하지 않음.
- `db/schema.ts`와 기존 `tests/case-calculation-feature-store.test.ts`의 SQLite DDL적용·리드백·CAS 코드 및 `form-mapping.ts`의 D5110 creditor/회차별 일정 표시·금액 표시 조건 읽음. **이번 실행에서 직접 SQLite insert/replay, D1 staging, 실제 Word/PDF 생성, 42 path 실계산은 수행하지 않음**. `A2-DATA-017`, `A2-IT-015`, `A2-DOC-005` 여전히 부분 코드 검토.

## 4. 법령/법원·세무 공식 원문 검토 및 인수 경계
- 국가법령정보센터 채무자회생법 [시행 **2026-10-02**] 법률 제21490호 [2026-03-24 타법개정] 판본의 제589조 제2항 제1호 채권자 목록에 채권 원인·금액 명시와 수입·지출 목록 첨부 등 조문 확인: https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1026939177 . 이는 근거 불명 금액으로 공식 목록을 확정하면 안 되는 검토 이유이지, 이 새 guard의 구체 오류코드가 법률에 의무라는 뜻은 아님.
- 서울회생법원 **2026-10-01** 공식 보도자료 목록에 실무준칙 424호 개인회생 변제기간 단축 대상 개정 게시 확인: https://slb.scourt.go.kr/dcboard/new/DcNewsListAction.work?gubun=172 . 제7호 사건별 적용 여부는 이번에 따로 판정하지 않았고, PR #18 관할 미정 보류 원칙 유지. 사건별 시행/접수일·관할과 변호사 검토 필요.
- 국세청 공식 사업소득/VAT 안내: https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7802 ; 국세청 사이트 접속 확인. **이번에 사업 순소득 세무식은 재검증·변경하지 않음**, VAT 산식을 법원 인정 소득이라고 쓰지 않음.
- 법원 최신 D5110 전자서식 실제 파일과 생성 Word bytes / 제출·변호사 전문가 검토는 이번에 확인하지 못했다. 내부 시스템 가드 개선으로 법적 적합성 승인 주장 금지.

## 5. 회차 산출/인수 상태/다음
| ID·관점 | 이번에 실제 한 일 | 미인증 |
| --- | --- | --- |
| A2-LAW-021 변호사 | 2026-10-02 법 제589조·2026-10-01 서울 개정 공지 official source 웹 확인 | 사건 관할·시행일 개별 적용, 변호사 결정 |
| A2-DATA-017 데이터 | 18/91/78/42 catalog 파싱 및 저장·replay 코드 경로 검토 | 42 output 경로 실제 저장·재독 전수 |
| A2-IT-015 IT | 실제 DB/스토어와 독립 replay/Node test 코드 검토 | 이번 회차 SQLite 실제 run, staging D1/Cron |
| A2-CALC-026 계산사무장 | BigInt ledger 15경계, 예산 초과 3이슈 격리 재현 | 전 엔진 36/48/60 분배 및 2 워커 |
| A2-DOC-005 서류담당자 | D5110 creditor 금액/일자 code read | 실제 DOCX/공식 서식 행·토큰 동등성 |

- **이번 축 제품 체크 [x] = 0건, RELEASE_READY = 0건**. main 코드 변경 0건. 안전 수정은 Draft PR #29 코드+회귀 소스 보관·미병합.
- 실행 층: `CODE_REVIEWED` 및 `SYNTHETIC_EXECUTED`(GitHub 원본 함수 본문 격리 V8). 누락: `LOCAL_REGRESSION_PASS`(Node test runner / npm lint / build), `STAGING_D1_R2_PASS`, `OFFICIAL_SOURCE_REVIEWED`(제589조·424호 공지는 일부만 확인; 실제 D5110·사건적용은 미확인), `LAWYER_SIGNED`, `RELEASE_READY`.
- **다음 A2**: #29/#25 병합 시 회귀·날짜·금액 테스트(중복 덮어쓰기 금지); `A2-DATA-017` 42 output/SQL replay; `A2-IT-015` 실제 D1 staging; `A2-DOC-005` 법원 D5110 Word 렌더링·원단위/날짜; `A2-LAW-021` 법/준칙·관할/시행일 변호사 승인. 신규 역할 순환은 직전 회차와 중복 아닌 미검증 주제부터.
