# FirmEngine A2 6차 — SQL 계산 피처 누락이 전체 replay 성공으로 위장되는 P1 (2026-10-30 18:07~18:14 KST)

## 범위·현재 기준
- 프로젝트: `firmengine/firmengine`, 수정 허용: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 내부만. 최초/기록 전 main HEAD: `b10a3d3450266eee7b30a3d2fbdb6dd54aa748c7`.
- 이전 A2 5차 영수증: `docs/release-audit-runs/A2/2026-10-30_1710_KST_claim-balance-typed-failclosed.md`. 이전 결함 #25(월말), #29(미확정 채권 잔액) 두 Draft PR을 읽고 두 PR이 건드리는 `lib/repayment-plan-model.ts`와 `payment-schedule.ts`는 수정하지 않았다. 최근 A1 #32, A3 #30, A4 #31 및 최신 main 커밋도 확인.
- 선택한 **5개** 체크: `A2-AX-015`(독립 예상/실측 오라클), `A2-DATA-017`(SQL outputPath 전체 재현), `A2-IT-011`(5000행 경계), `A2-DOC-015`(서류 누락·출력 인수 경계), `A2-CALC-030`(0/null/누락 등 산식 케이스). 직전 법률·데이터·IT·계산·서류 순환에서 이번에는 AX를 먼저 확인했다. 모두 **[ ] 부분검증**이다.

## 1. 실제 결함 재현 — 0건 및 일부 행의 false PASS
- 현재 main `lib/preapproval-calculation-replay.ts`는 저장된 `rows`만 순회하여 `valid=Object.keys(counts).length===0`을 산출한다. 따라서 **저장행이 0건이면 `valid:true`**, 현재 실행 `monthlyIncomeWon=3000000`인데 SQL 값이 해당 한 건만 존재하고 `presentValueWon=null` 등 다른 예상 출력행이 누락되어도 **`valid:true`**다. 저장값이 올바른지 검사하는 것과 저장결과의 완결성을 검사하는 것이 다르다.
- 재현은 GitHub에서 읽은 **실제** `preapproval-calculation-replay.ts` 원문 함수에서 타입 선언만 제거하여 V8에서 직접 실행했다. 합성 execution: `{assessment:{calculation:{monthlyIncomeWon:"3000000",presentValueWon:null,incomeRows:[{monthlyWon:"0"}]}},courtApprovalInferred:false}`; SQL형 row는 `calculationId/outputPath/outputName/valueJson/status/sourceFactIdsJson`을 사용. 원래 코드에서 `rows:[]`과 `1/3 저장`은 `valid:true`로 재현됐다.
- 독립 기대값: 저장 0건 = `EMPTY_STORED_OUTPUTS`, 예상 출력 중 누락행 = `EXPECTED_OUTPUT_NOT_PERSISTED`, 모두 존재하고 값/원문 ID 일치 = valid true, JSON 값 상충/0↔null/중복/오래된 Fact는 기존 오류 유지. 하나의 기댓값은 물리 법률적 인정값이 아니라 **SQL 저장 계약의 무결성**이다.

## 2. 능동 개선안 — 미병합 Draft PR #33
- PR: https://github.com/firmengine/firmengine/pull/33; branch `audit/a2-replay-output-coverage-20261030-1810`; 마지막 수정 `427bcfca3515e08b2ac7eaf2582b9f5b4b0ec3bf`.
- `lib/preapproval-calculation-replay.ts`: 0행을 false PASS로 두지 않고, `expectedOutputs?: readonly {calculationId;outputPath}[]`를 통해 실행당 **정확한 저장 출력 ID+JSON pointer**의 누락을 검사한다. 배열·0·null은 JSON값을 그대로 보존하며 산술을 새로 구현하지 않는다.
- `app/api/cases/[id]/approval-readiness/route.ts`: 기존 읽기 전용 사전인가 진단에 `calculationFeatureRows(execution)`이 실제 직렬화할 출력 path 목록을 전달한다. 미완전하면 `calculationCurrent=false`. 이는 **read-only 준비도/표시판정**이지 법원 결정 또는 모든 최종 Word writer를 실제로 차단했다는 증거가 아니다.
- `tests/preapproval-calculation-replay.test.ts`: 0건/1개 누락/계산ID 불일치/0 vs null 신규 4개 테스트를 추가했다. 별도 SQL schema 변경·법률 기준 변경·법원 서류 작성/실제 DB 배포 없음.
- PR이 변경한 **파일 3개 전부 정확히 `ax-site` 내부**임을 GitHub diff에서 재확인. 현재 main 미병합, 운영 영향 없음.

## 3. 실제 검증 기록/한계
- 원본·수정 함수 본문의 TS 타입만 제거해 JS V8에서 직접 실행한 10개 시나리오 **10/10 기대일치**: 0행, 1/3, 2/3, 3/3, 중복, 0/NULL 상충, stale Fact, malformed JSON, 구 호출자 optional 호환, 중복 expected 선언.
- PR의 **실제 테스트 파일 9개**를 읽어 타입 선언만 제거하여 동일 PR의 실제 함수에 연결한 V8 격리 실행에서 **9/9 통과**(기존 5개 + 신규 4개). 별도 전체 Node test runner 실행/TypeScript 타입검사/프로젝트 CI는 아니다.
- 공식 기본 스키마 `drizzle/0011_case_calculation_features.sql`의 PK `id`·`run_id` FK·`calculation_id`·`output_path`·`value_json` 컬럼을 확인. 실제 staging Cloudflare D1 INSERT/SELECT, 서버 route HTTP GET, 이중 워커, 최신 전체 Word/PDF 생성은 **미실행**.
- `lib/reference-decision-tables.json` 실제 파싱: 계산 18모듈, 입력 선언 91(서로 다른 입력 path 78), 출력/이종 API resultPaths 42. 42개는 **SQL 피처행 42개와 같지 않다**: catalog 19개 `/result/assessment/calculation`, 3개 `/result/proposals`, 20개 별도 disposition/schedule/transaction/form/document API. 실제 DB는 `/assessment/calculation` 및 `/proposals` leaf output과 `/courtApprovalInferred`를 직렬화하며, 출력 건수는 동적 반복행 수에 따라 변한다. **42개 전체 통합 E2E 합격 0건**.
- `lib/case-calculation-feature-store.ts`는 결과 5,000행 초과 시 `CALCULATION_FEATURE_COUNT_LIMIT`, readiness API는 SQL 조회 `LIMIT 5001`과 `<=5000` 검사로 명시된 초과를 차단하는 코드가 있음. 5,000/5,001개 실제 DB·HTTP 경계는 **이번에 실행하지 않았다**.
- 법률·공식 출처 확인(2026-10-30): 국가법령정보센터 **채무자회생법 2026-10-02 시행 제589조 ②**는 채권자 목록/재산목록/수입지출 목록·소득증명 자료 등의 첨부를 명시: https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1026939177 ; 서울회생법원 **2026-10-01** 보도자료 게시목록에 제424호 변제기간 단축 준칙 개정 기록: https://slb.scourt.go.kr/dcboard/new/DcNewsListAction.work?gubun=172 ; 국세청 일반과세/간이과세 VAT 산식은 별도 분류: https://sc.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7693&mi=2272 . 이번 수정은 세무 산식/424호 조건에 손대지 않았고 **사건별 법적 판단·실무자 승인 미인증**.

## 4. 현재 결과·후속
- `A2-DATA-017`: 부분실행. 빈/부분 SQL output false PASS 제거 제안. 실제 모든 execution leaf의 SQL 재독/비교, 42 이종 결과 경로 E2E 미완.
- `A2-IT-011`: 5,000행 상한/5,001행 명시 실패의 **코드경계 확인만**. 실제 D1 대량 SQL 미실행.
- `A2-AX-015`: 저장 출력 completeness 10/10 격리 독립 기대일치. 모델 추론/법원 산술 전체 아니며 전체 Node 미실행.
- `A2-DOC-015`: 사전인가 read-only 준비도 누락 가드 제안. 최종 Word writer/법원 D5110 실제 파일 미인증, 별도 PR #21 유지.
- `A2-CALC-030`: 0/NULL/빈 JSON·중복 예상행과 기존 수치의 부정 test 9/9. 18개 산식 전체 golden/91 입력 실제 연결 미인증.
- **이번 회차 [x] 0개, 제품 RELEASE_READY 0개.** main 코드 변경 없음. 이미 승인된 법률값/원본 추출·산식을 수정하지 않고 Draft PR로 격리했다.
- 다음: PR #33의 실제 Node 22 `--experimental-strip-types --test tests/preapproval-calculation-replay.test.ts` + 타입/전체 CI를 실행하고, 5,000/5,001 SQL 대량 출력과 정상/누락/상충/복수 repeated rows를 staging D1로 검증. 42 output resultPaths는 각 모듈별 실제 실행 API의 결과와 별도로 전수 대조. PR #25/#29 병합시 월말 변제일·채권 원금 누락 차단 테스트를 충돌 없이 결합하고 D5110 Word 출력·법원/변호사 검토를 받은 뒤 인수 여부 결정.
