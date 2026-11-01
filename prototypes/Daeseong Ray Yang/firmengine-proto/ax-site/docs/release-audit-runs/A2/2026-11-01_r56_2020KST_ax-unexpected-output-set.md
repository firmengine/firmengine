# FirmEngine A2 56차 — AX담당자: SQL 계산 출력집합의 역방향 검증 누락

- 감사 기준: 2026-11-01 KST / **직전 55차 데이터담당자 → 이번 56차 AX담당자 → 다음 57차 IT담당자**.
- 대상: **A2-AX-004, A2-AX-015, A2-AX-017, A2-AX-018**. 네 ID 모두 **[ ] 부분검증/미완료**이며 법률상 인정소득·인가/세무회계 적합성은 미인증.
- 최초 확인 main HEAD: `4f9a12f374200bf1f0e7d04bd52a046923a1cf75`; main 계산 replay blob `9517e71ee238955ee4af679bce1ebced888c4432`; 직전 [r55](2026-11-01_r55_1910KST_data-crosscalc-output-path-sql-replay.md).
- 선행 Draft [#71](https://github.com/firmengine/firmengine/pull/71) → [#135](https://github.com/firmengine/firmengine/pull/135) → 이번 **[Draft #136](https://github.com/firmengine/firmengine/pull/136)**, 선행 #135 HEAD `40030f07cba45788c6674b9357cde747ee1d1be8`; #135 replay blob `c3b2817b03d288523ee5d656d4e10f8a35087228`.

## 1. 확인 대상 실제 파일·계약·기존 시험

- `lib/preapproval-calculation-replay.ts`: main과 #135 실제 원문 읽음. 기존 #135는 (계산ID, 출력경로) **누락** 및 물리 JSON pointer **중복**은 검사하나, 실제 저장된 출력행이 이번 실행의 정확한 `expectedOutputs`에 **포함되는지 역방향 검사는 하지 않음**.
- `app/api/cases/[id]/approval-readiness/route.ts`: main blob `731f66a10d4af704b432dcd298061b452941fd13`는 `expectedOutputs` 미전달. #135 위 스택에서는 `calculationFeatureRows(execution).map(...)`을 전달함. 따라서 **현재 main은 이 새 검사 적용 대상이 아니며**, 스택 전체 통합 후에만 이 기능이 실제 사용됨.
- `lib/case-calculation-feature-store.ts` main blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`; `drizzle/0011_case_calculation_features.sql` main blob `0caa359d250dce45765d269d271ad63170ec3efa`. SQL은 `id` PK 및 `run_id` FK이지만 `run_id + calculation_id + output_path`의 정확한 생산자 계약이나 전체 출력집합 일치를 선언적으로 강제하지 않음.
- `tests/preapproval-calculation-replay.test.ts` main blob `8d8459d43c9f1ebd8c596526e1b35fb620a3ae0f`, #135의 기존 8개 신규 테스트를 읽고 계승. **실제 프로젝트 Node 테스트·CI는 이번 회차 미실행**.

## 2. P1 후보: 허가되지 않은 출력행의 거짓 정상

**합성 입력 — 실제 고객자료 아님**

- execution: `{assessment:{calculation:{monthlyIncomeWon:"2400000",debtInterestWon:"0",unobserved:null}}}`.
- 기대 생산자 집합: `[{calculationId:"income_average",outputPath:"/assessment/calculation/monthlyIncomeWon"}]`.
- SQL 행 1: `income_average`, 경로 `/assessment/calculation/monthlyIncomeWon`, `value_json="\"2400000\""`, `value_won="2400000"`, `status=computed`, `source_fact_ids_json=["SYN-F1"]`.
- SQL 행 2: **생산자 목록에 없는** `ghost`, 경로 `/assessment/calculation/debtInterestWon`, `value_json="\"0\""`, `value_won="0"`, `status=computed`, `source_fact_ids_json=["SYN-F1"]`.
- 독립 기대: 출처 Fact ID가 유효하고 값이 0원으로 정확하더라도 **현재 실행의 선언된 저장 출력집합에 존재하지 않는 행은 검토보류**. `0`과 `null`을 합치거나 정당한 금액을 임의 조정하지 않음.
- **실제 #135 원본문**: 위 2행은 경로/값/Fact 모두 개별 정합이라 `valid=true`, `issues={}` **거짓 정상**. 추가 null+missing 행도 같은 거짓 정상. `expectedOutputs=[]`인데 SQL 행이 있는 경우도 거짓 정상.
- **이번 후보**: `expectedOutputs`가 명시된 경우만 양방향 집합 비교. 기존 `EXPECTED_OUTPUT_NOT_PERSISTED`에 더해 `UNEXPECTED_OUTPUT_PERSISTED` 보고. `expectedOutputs` 미제공은 호환성을 위해 기존 약한 검사로 남김(이는 미완료 위험).
- 실제 GitHub 코드에서 **함수 본문을 추출, 타입 표기만 제거해 V8 실행**: 기존/후보 10개 합성 반례 모두 독립 예상 결과 일치. 명시적 0, null, 빈 계약, 누락+여분, 행 순서 역전, 무계약 후방호환, 기존 포인터 중복을 포함함.
- 별도 **실제 main 생산기 함수** `calculationFeatureRows()`의 원본문을 V8 격리 실행(18계산 정적 규격 사용, 실제 엔진 실행 아닌 합성 최소 execution): 8개 피처 / 8개 고유 포인터 생성. proposal 3필드를 `null`로 *명시*한 합성계약은 replay `valid=true`; 생산기가 기록하지 않은 기존 내부 경로 `/assessment/calculation/incomeRows/0/id`를 1행 추가하면 후보 `UNEXPECTED_OUTPUT_PERSISTED=1`, `valid=false`. 처음에 proposal 필드 자체 미관찰일 때는 기존 `RUNTIME_OUTPUT_MISSING=3`을 관찰했으며, `null`과 **경로 부재**를 다르게 취급한다는 점도 재확인했다.
- 주의: 10개 함수 합성 비교와 8행 생산기 격리시험은 **V8 격리 실행 결과**일 뿐, 전체 `executeCaseNodes()`→실제 SQL INSERT/SELECT→실제 DOCX 출력 Node/D1 종단시험 아님.

## 3. 수정 코드·테스트·수준

- 새 **Draft PR #136**, 선행 #135 브랜치를 base로 하는 stacked PR; main 제품 코드 **미변경**.
- `lib/preapproval-calculation-replay.ts`의 enum 및 `expectedPairs` 집합 1개, 실제 저장행별 역방향 확인만 추가. **법적 인정, 계산 금액, 회계 산식, SQL DDL, Word 토큰 변경 없음**.
- 코드 커밋 `c42a3aa4464ddd7be6d9aceecc65ba50ad275e29`, blob `f579b0fc0c6efbfdddc58ea3e207ab5e88ea9164`.
- 신규 `tests/a2-r56-unexpected-replay-output.test.ts`: 합성 Node 회귀 **10개 작성·커밋**, 코드/tests 브랜치 HEAD `dde45ee69e7a0dccb1e6acc4f08f7d4eb5c77bed`; 테스트 blob `7031f9d4d86b5e88a882d6d251ea13a0c2143511`. 이 10개는 **Node 테스트러너에서 미실행**.
- compare #135 → #136: 변경 2개 파일, 모두 지정된 `ax-site` 내부; 선행 기능/타 에이전트 코드 덮어쓰기 없음. 병합 금지, 실무자 검토 필요.

## 4. 독립 산술 및 저장·서식 정적 계약 (증빙 경계)

- 독립 예: 급여 `2,400,000×12=28,800,000원`; 사업 관측 `1,000,000×11=11,000,000원`; 관측 합계 `39,800,000원`. 사업 12번째 월은 **미관찰**이며 월소득/법적 인정소득으로 채우지 않음.
- 예시 900,000원 월제안 ×36/48/60개월 = `32,400,000 / 43,200,000 / 54,000,000원`. 기간별 법률 적합성/배분·현재 엔진 실제 출력과는 별도.
- `lib/reference-decision-tables.json` blob `6924e3977caf748ce8a3d617fae15aff7d2fe2ce` 파싱: 계산 18모듈, 입력 선언 91(고유 78), 출력 선언 42(고유 40), 결과경로 선언 42(고유 42).
- `lib/template-token-catalog.json` blob `899c4d564fcb1726861f89dcf04dbf1b7e372687`: D5103 37, D5110 55, D5111 82 등록 토큰. 정적 카탈로그 수는 실제 Word 템플릿 동등성/공식 서식 승인과 다름.
- 구분: **미관찰(키 부재)** / **명시적 null** / **원단위 0** / **비해당** / **상충** / **source-only** / **provisional** / **법적 승인전**. 어떤 상태도 계산만으로 법률상 확정값 승격 금지.

## 5. 공식 법률·세무 출처와 관할·시행 경계

- 국가법령정보센터 공식 `채무자 회생 및 파산에 관한 법률` **[시행 2026-10-02] [법률 제21490호]** 제611조: https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777 ; 제614조: https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710759 . 제611조 변제기간은 원칙 3년, 특별 사정이면 5년 범위(법 조문 그대로), 제614조 인가요건은 산식 결과/SQL 상태와 별개.
- 서울회생법원 공식 2026-10-01 공지, 실무준칙 **제424호 제2조 제2항 제7호 신설**: https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&seqnum=3187 . **공지일을 모든 사건에 대한 효력·적용일로 승격하지 않음**. 첨부 원문 부칙·경과규정 및 사건별 적용일/관할은 이번 회차 미검증, 사람 검토 필요.
- 국세청 공식 일반과세자 VAT 반기·간이과세자 통상 연간: https://nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7806&mi=2486 . VAT 매출/신고액을 순소득으로 자동 승격하지 않음.
- 법률·회계 최종 적합성은 변호사·계산사무장·세무 담당자 승인 전 **미인증**.

## 6. A2 ID별 결과·다음 순서

- **A2-AX-004 [ ]**: 기존 #135가 저장 `"0"`/null 여분 출력은 거짓 정상; #136 격리 후보는 구분 유지+검토보류. 실제 DB·typed E2E 미완료.
- **A2-AX-015 [ ]**: 원본 replay 10개 합성 예상/실제, main 생산기 8/8 원문 본문 격리; 18모듈 엔진·91입력/42출력 독립 산술/SQL 재독/DOCX 미완료.
- **A2-AX-017 [ ]**: 후보의 결과 `valid=false`는 데이터 무결성만 의미. `courtApprovalInferred=false` 유지, 변호사/법원 인가 미확정.
- **A2-AX-018 [ ]**: 원문/변경 blob, SHA, 합성 입력, 기대/관찰, 공식 근거, 미실행 범위를 분리 기록. 전체 시나리오 품질지표 아님.
- **다음 57차 IT담당자:** #71→#135→#136의 Node 22 회귀테스트/실제 CI; 모든 producer row 계약 양방향 검증과 안정적인 `calculationId` 계보, 18×91→42 SQL 라운드트립·서식 토큰/실제 DOCX 연계. #130·#133 및 기준판본 P0와 충돌 여부 확인. **실제 Node/CI, staging D1·R2/Cron, 공식 서식, 배포, 변호사 승인, 법원 인가 전 제품 인수 0건**.
