# FirmEngine A2 8차 — 원장 무결성/5,000행 SQL 격리 및 미병합 PR 교차 (2026-10-30 KST)

## 0. 범위·선행 상태

- 대상 `firmengine/firmengine` **main**, 정확히 `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만 읽고 작성. 감사 시작 main `ba93dfcd7dd6c032e596e5d2ca28d0961279573a`, 영수증 쓰기 직전 최신 main `ba93dfcd7dd6c032e596e5d2ca28d0961279573a`. 과거 A2 7차 영수증·보드·A1/A3/A4 최근 변경·열린 Draft PR #13/#18/#21/#25/#29/#33/#37/#38 등을 확인.
- **체크 ID 5개·6역할 순환**: 이번에는 AX `A2-AX-015`, 데이터 `A2-DATA-024`, 계산사무장 `A2-CALC-030`, IT `A2-IT-006`, 서류담당 `A2-DOC-005`; 전회차 마지막 데이터 담당 이후 AX부터 시작. 변호사 `A2-LAW-021` 등은 다음 회차 우선 재진입. 5개 모두 **[ ] 부분검증**; 제품 `RELEASE_READY` **0건**.
- 범위별 정확한 판단 층: GitHub 실제 소스 확인 / TypeScript 구문만 제거한 원 함수 본문 격리 V8 / 실제 `drizzle/0011_case_calculation_features.sql` 테이블·인덱스 구조를 동등 작성한 로컬 SQLite / TypeScript Node 테스트 작성(미실행) / staging D1·R2/Cron 미실행 / 공식서식·변호사 승인 미확보.

## 1. P1 신규 결함 — 변제원장 금액·분류·잔액 무결성

실제 main `lib/plan-reconciliation.ts` 함수 본문에서 TypeScript annotation과 import만 제외하고, 호출되는 외부 `moneyValue`에는 합성 typed amount 읽기 스텁만 적용하여 V8에서 재현:

| 합성 사건(원/1회) | 독립 기대 | 현재 main 실제 | 수정안 격리 실제 |
| --- | --- | --- | --- |
| 10원 채권, 1원 납부, 잔액 9원 | reconciled | reconciled | reconciled |
| 원금 `"oops"` | blocked | **BigInt SyntaxError** | blocked / `INVALID_LEDGER_ROW:1` |
| 원금 `null` | blocked | **BigInt TypeError** | blocked / `INVALID_LEDGER_ROW:1` |
| 이자 `"unknown"` | blocked | **BigInt SyntaxError** | blocked / `INVALID_LEDGER_ROW:1` |
| `claimClass="fabricated"` | blocked | **reconciled** (비정상적으로 trusteeFeeWon에 포함) | blocked / `INVALID_LEDGER_ROW:1` |
| 일반채권에 `fundingSourceId="priority_budget"` | blocked | **reconciled** | blocked / `INVALID_LEDGER_ROW:1` |
| 10원 채권 1원 납부인데 `balanceAfter="999"` | blocked | **reconciled** | blocked / `BALANCE_AFTER_MISMATCH:d1:1` |
| 실제 0원 납부 및 남은 원금 10원 | reconciled | reconciled | reconciled |

- 분류·지급재원 값 확인은 **코드 내부 원장 enum 계약** 점검이며, 별제권·우선채권 등 법적 분류 자체를 자동 결정하지 않는다.
- 실패행은 산술을 시작하기 전 `blocked`, 명시적 오류 및 `LEDGER_INPUT_STRUCTURAL_FAILURE` 검토요청을 반환한다. 반환 타입 유지를 위해 포함한 0원 합계는 **blocked 상태의 placeholder**일 뿐 실질 확인된 0원 의미가 아니다.
- 각 채권의 `balanceAfter`가 원래 금액에서 누적지급액을 공제한 값(0 아래는 0)과 같지 않으면 `BALANCE_AFTER_MISMATCH`; 회계상 잔액 확인이며 법률상 채권인정은 별개.
- **새 수정안 Draft PR #43**: https://github.com/firmengine/firmengine/pull/43 . 소스 한 파일과 **TypeScript Node 회귀 테스트 9개**를 추가했으며 **정식 `node --test`·프로젝트 lint/build는 미실행**.
- 실제 원 함수 본문과 수정 함수 본문을 같은 V8 격리 환경에서 돌린 **8/8 기대값 일치**, 다른 미병합 Draft PR #37의 납부일 누락 차단을 합성 결합한 동일 함수본문 V8 **6/6** 기대값 일치. Git 실제 3-way merge 및 통합 Node 빌드 합격은 **확인하지 않았다**.

## 2. 합성 SQLite 5,000/5,001행 저장·재독 — DB 계층 한정

- `drizzle/0011_case_calculation_features.sql`의 **계산 run/features/heads 3개 CREATE TABLE 및 2개 인덱스 정의를 동일하게 사용**, 부모 `cases(id)`는 시험용 최소 테이블로 대체. 따라서 **원본 전체 migration 0000~0022를 실제 적용한 증거가 아니다**.
- 13열 `case_calculation_features`의 실제 INSERT 컬럼 순서와 `Math.floor(90/13)=6` 건 단위, 단건 78 bind에 맞춘 합성 SQL을 실행. 5,000건→**834개 INSERT statement**, SQLite 메모리 DB에 **5,000행 실제 삽입·500행씩 10회 읽기 성공**, FK 검사 0건.
- 합성 `value_won="0"`의 **실제 0원 715건**, `value_won=null` 미관찰 4,285건을 `value_json`과 대조해 구분. 한 행 삭제 시 기대 집합(5,001)−실제집합을 비교해 **`/synthetic/output/4567` 누락 정확히 검출**.
- SQL 스키마만으로 5,001번째 row 삽입은 **실제로 허용**됐다. 따라서 5,000 상한은 **DB constraint가 아니라 현행 `persistCaseCalculationFeatures`의 `if(rows.length>5000)` 응용 계층 가드**이며 이 가드를 우회하는 쓰기 경로는 별도 점검 필요.
- 이는 **실제 D1 staging 저장/재조회/Cloudflare 행용량 검증이 아니다**. 개별 `raw_result_json/source_heads_json/missing_json` 합산 행 상한 Draft PR #38과 저장 누락 replay Draft PR #33도 아직 미병합.
- 합성 실행 스크립트 작업공간: `/mnt/data/firmengine_a2_r08_sqlite_isolation.py` (대화 실행 런타임 내부에서 실행). 원본 개인정보·의뢰인 증빙/정답 사용 없음.

## 3. 18/91/42 등록 명세 및 PR 상호 영향

- 최신 `lib/reference-decision-tables.json` 파싱: 계산 **18개 모듈, 입력 선언 91개, 등록 resultPaths 42개(42 고유)**. 위 수는 **정적 등록 검증**이지 91개 입력·42개 산식 결과의 실제 계산/공식 D5110 출력 일치를 증명하지 않는다.
- 현재 열린 Draft PR 중 수정 파일 중첩 확인: **#25와 #29는 `lib/repayment-plan-model.ts`**, **#37과 #43은 `lib/plan-reconciliation.ts`**. #33은 replay 읽기 경로, #38은 run 저장 계층으로 **직접 동일 파일은 아니지만 출력 누락 판단의 계약·스냅샷을 함께 검증해야 한다**.
- PR #37 + #43의 함수 본문 합성 결합 동작은 6/6 적합. **충돌 없는 Git rebase·전체 Node/CI·PR #25/#29의 실제 병합 테스트는 수행하지 않았으므로** 이 PR들을 그대로 순차 병합하지 말 것.
- D5110/D5103의 실제 Word 출력·공식 템플릿 행·날짜·금액은 여전히 **미실행**. 정적 `form-mapping.ts`·`office-writer.ts` 경로의 존재는 인수 합격이 아니다.

## 4. 공신력 있는 법률·서식·세무 출처 및 별도 인수

- 국가법령정보센터 「채무자 회생 및 파산에 관한 법률」 **[시행 2026. 10. 2., 법률 제21490호, 2026. 3. 24., 타법개정]**의 공식 페이지 확인. 확인 URL은 제10조 조문정보 페이지이므로 **제579/589/611/614의 전문을 이 링크만으로 검증했다고 주장하지 않는다**: https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1027010029
- 서울회생법원 공식 **2026.10.01** 「개인회생 변제기간 단축 대상에 관한 실무준칙 개정」 공지: 제424호 제2조 제2항 **제7호 신설** 표시. 보도자료 화면 자체의 내용을 확인한 것이며 사건별 **실제 준칙 PDF 부칙·적용일·개별 법률 요건/변호사 승인**은 이번 회차 별도 미검증: https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187
- 국세청 공식 「부가가치세 안내」: 일반과세자·간이과세자의 과세기간 및 매출세액·매입세액 차이 확인. **VAT 세액/신고 매출을 사업 인정 순소득으로 자동 합산 금지**, 이번 코드는 세무 산식을 바꾸지 않음: https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7802&mi=2480
- 대한민국 법원 공개 서식 검색: https://www.scourt.go.kr/nm/minwon/doc/ProDocList.work . 실제 최신 D5110 DOCX/PDF 바이트 검수와 변호사 서명 미실행.

## 5. 체크 ID, 결함 심각도, 다음 회차

| 체크 ID | 담당 | 이번 실측·증거 | 인수 상태 |
| --- | --- | --- | --- |
| `A2-AX-015` | AX | main 원 함수 격리 8건 전후 비교; #37 결합 6건 V8 재현 | **[ ] 부분**; 모델→산식→DB·전체 Node 불인증 |
| `A2-DATA-024` | 데이터 | 로컬 SQLite 실제 5,000행 insert/read, FK, 0/null 구분, 1개 누락 탐지 | **[ ] 부분**; 전체 migration·staging D1 미인증 |
| `A2-CALC-030` | 계산사무장 | null/오인식/분류/재원/잔액 상충 8개 독립 기대값 vs 함수 본문 | **[ ] 부분**; 18모듈/91입력 실제 실행 불인증 |
| `A2-IT-006` | IT | 실제 0원과 오류 타입 차이, 결측이 BigInt 런타임 오류로 전파됨을 확인 | **[ ] 부분**; 거액·원/만원 변환 E2E 미인증 |
| `A2-DOC-005` | 서류담당 | PR #25/#29/#37/#43 값·날짜·결손 경로 교차 영향 확인 | **[ ] 부분**; D5110 Word 실제값/법원 원본 미인증 |

**변경 파일**: 제품 코드 수정안 Draft PR #43(미병합, 도메인/법적 산식 의미 변경하지 않음), 본 회차 main에는 독립 영수증 및 중앙 보드의 해당 ID만 추가.

**다음 A2 우선**: 실제 Node 22 프로젝트 테스트(신규 9개+기존 날짜 5개/원금 9개), PR #25/#29/#37/#43 통합 머지 충돌 해소 전 검증, D5110 Word/배분 금액·회차 36·48·60 전수, 계산 91 입력·42 서로 다른 output path의 실제 저장 replay + Staging D1 5,000/5,001 경계, A2-LAW 관점으로 다음 역할 순환. 실제 법률·회계 승인 없이 자동 법적 판단 변경/제출/배포 금지.
