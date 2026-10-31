# FirmEngine A2 r32 — AX담당자: reference SHA·계산 run·페이지 CAS 통합 경계

- 일시: 2026-10-31 KST. 6역할 순환: **r31 데이터담당자 → r32 AX담당자 → r33 IT담당자**.
- 허용 경로: `prototypes/Daeseong Ray Yang/firmengine-proto/ax-site/` 한정. 실제 고객·OCR 원본·비공개 정답·키 없음.
- 시작 main HEAD(이번 검사에서 읽은 최신): `1ae95dd9173a9b062cbbdb56e4ae439300b3278b`. 이전 r31 영수증 `docs/release-audit-runs/A2/2026-10-31_r31_1916KST_data-reference-head-freshness.md` 확인. main 최근 A1/A3/A4/A2 커밋·Draft PR #49/#58/#67/#71/#79/#81/#84/#87와 스키마·원본 함수·테스트 확인.
- 이번 보드 ID: **A2-AX-011**, **A2-AX-013**, **A2-AX-017**, **A2-AX-018**. 모두 **부분 검증 [ ] 유지**, 법률·회계·제품 인수 **0건**.

## 1. 검증한 실제 소스와 판본

- main `lib/case-calculation-feature-store.ts` blob `bb5f88b26e68f5ae2234741063ac9301a927e27a`: immutable run/feature 저장, head UPSERT, 2단계 조회, `status/headStale` 반환.
- main `drizzle/0011_case_calculation_features.sql` blob `0caa359d250dce45765d269d271ad63170ec3efa`; `lib/case-data-recompute.ts` blob `cd967ced1c8262b1e8c67d62c2a373e4d2e2be94`; `tests/case-calculation-feature-store.test.ts` blob `844525d8633442d571ced2c48ed5bd00ba7bb5a0`.
- [Draft PR #49](https://github.com/firmengine/firmengine/pull/49) 동일 store 파일 blob `429295821f171de76a4a1133df73fd2cf384c23c`: `afterHead.run_id` 판본 재확인 및 `expectedRunId` CAS 제안.
- [Draft PR #87](https://github.com/firmengine/firmengine/pull/87) 동일 store 파일 blob `4e38e81220a82cc4e6e55ce5550e7664e79c3eb1`, helper `calculation-head-freshness.ts` blob `db9a5c01f799c575ab21eb1aaa83bc22a0370e1a`: 활성 reference SHA 비교를 통한 조회 stale 보강 제안.
- **#49와 #87은 동일 `headStale` 반환행을 수정하므로 기계적인 독립 병합 금지.** 각 Draft를 main 제품 변경으로 간주하지 않음.

## 2. 합성 입력과 독립 기대값

인메모리 Python `sqlite3`에 `0011`의 `case_calculation_runs/features/heads` 3테이블 **동일 DDL**(minimal `cases`, `case_data_change_state` 외부키 스텁) 및 main의 **실제 head UPSERT SQL 술어**를 적용. 운영/스테이징 D1 아님.

합성 사건 `synthetic-r32`, `caseRevision=7`, `dataVersion=4`, `inputSha256=111…(64자리)`:
- 현재 계산 run B = `calculation-bbb…`, reference SHA `bbb…`(64자리); `approvedMonthlyIncomeWon=2400000`, 두 번째 출력 `disposableIncomeWon=2400000`; 둘 다 `status=computed`.
- 지연된 구판본 run A = `calculation-aaa…`, reference SHA `aaa…`(64자리); 같은 두 출력 `0`과 `0`(명시적 **0원**, SQL NULL 아님).
- 독립 기대: 기준판본 B에서 생성한 조회는 run B와 원화 값 2,400,000만 수용, A가 뒤늦게 도착하면 **head B 유지**. 페이지1/run B 이후 페이지2/run A를 하나의 응답으로 섞어서는 안 됨. 구판본을 반환한다면 `headStale=true`, 사람 승인값으로 승격 금지.

## 3. 실제 실행·관찰 결과

### SQLite replay: 16/16 기대 일치(버그 재현 포함)
- B 최초 승격 `changes=1`, 첫 페이지 `2400000`.
- A 지연 승격 **`changes=1`**, SQL head가 **B→A로 덮임**. 사건 revision/dataVersion은 **7/4 그대로**.
- 페이지1 B `2400000` + 페이지2 A `0`이 별도 SQL 조회에서 만들어짐. main의 revision/dataVersion 재확인 술어만 적용 시 **오류 없이 혼합될 수 있음**.
- main 판정 `headStale=false`(version 동일), run 상태 `computed`; 활성 reference B 기준 A는 구판본. PR #87 read helper 기준 `headStale=true`. PR #49 runId guard 기준 변경 탐지·재조회 필요.
- 원래 B run의 값은 불변 유지. SQL `"0"`은 NULL과 구별, 외래키 위반 0.
- **주의:** 이 시험은 SQL/순차 읽기 삽입 재현이며 서버 전체 HTTP 엔드포인트의 실제 동시 요청/브라우저/Cloudflare D1 E2E 증명이 아님. 16/16은 결함 없음이 아니라 **독립 기대한 결함 양상까지 포함한 재현 성공**.

### GitHub 실제 함수 술어 V8 격리 15/15
- PR #87 helper의 **실제 `return !!head && (...)` 본문** 추출 실행: ref 동일, A/B 차이, 판본 교체, 사건/원본 버전 변경, SQL NULL, 명시적 0, head 없음 등 **9/9**.
- main/PR #49의 **실제 `after?.revision...` 조건식** 추출 실행: 동일 사건·원본판본에서 run 교체, 동일 run, dataVersion 변경, head 삭제/부재 등 **6/6**. main에서는 run 변경을 허용, #49에서는 `CALCULATION_VERSION_MISMATCH`로 차단.
- 이는 원문 조건식의 격리 실행이며 **PR #49+#87 병합본 전체 Node 프로젝트 import·테스트 아님**.

## 4. AX 판정 및 미완료

- **A2-AX-011** 계산 receipt SHA: main runId가 `inputSha256`, reference 객체, `sourceHeadsSha`, `rawResultSha`, rule/contract를 해시하는 코드 정적 확인. **실제 모델 응답 ↔ 원본 실행 receipt ↔ SQL 해시 E2E 대조는 미실행**, [ ] 유지.
- **A2-AX-013** 동적 기준정보 판본: #87 실제 SHA stale 가드의 9/9 격리 합격. 그러나 **쓰기 CAS 미해결**, 기준변경 중 실 D1 race·실제 법률 프롬프트 및 사건 승인 무효화 미확인, [ ] 유지.
- **A2-AX-017** 법률 승인 경계: 구판본 A가 `status=computed`로 재조회될 수 있음을 SQLite/코드에서 확인. `computed`는 **그 run이 기록한 당시 산술상태**이며 `headStale`·승인 플래그와 독립; 절대 법원 인가/법률 인정 표현 금지. [ ] 유지.
- **A2-AX-018** 품질 및 회귀: 합성 SQL 16/16, 원본문 격리 15/15를 입력·기대·실제·출처 판본으로 분리 기록. 18/91 전체 실측 품질지표와 운영/CI는 아님, [ ] 유지.
- **이번 제품 수정 없음**: 위험도가 높은 쓰기-CAS/승인 의미 변경은 근거 없이 main에 적용하지 않음. 이미 별도 Draft #49/#87이 같은 store 파일을 수정하므로 덮어쓰기/충돌 PR 중복 생성을 피함. 통합·트랜잭션 설계는 IT/데이터·변호사 검토 후 별도 브랜치/PR 필요.

## 5. 계산 계약·세무/법원 원문 정적 대조

GitHub main `lib/reference-decision-tables.json`과 `lib/template-token-catalog.json` 직접 JSON 파싱: **18모듈 / 91 입력 선언(고유 78) / 42 출력 선언(고유 이름 40) / 42 결과 경로**, 토큰 **D5103=37, D5110=55, D5111=82**. 원문→Fact→typed→SQL→서식 **전체 E2E는 미검증**.
- [법제처 시행 2026-10-02 법률 제21490호 제611조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710777): 변제기간 3년 원칙과 필요한 특별사정의 최대 5년; [제614조](https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1024710773): 인가요건은 별개.
- [서울회생법원 2026-10-01 공식 공지](https://slb.scourt.go.kr/dcboard/new/DcNewsViewAction.work?cbub_code=000221&gubun=172&pageIndex=1&searchWord=&seqnum=3187): 실무준칙 제424호 제2조 제2항 제7호 신설 **공지만 확인**. 첨부 개정전문 PDF 부칙/경과조치·개별 사건 적용일은 **미인증**. 사람 승인 없는 자동규칙 적용 금지.
- [국세청 VAT 공식 과세기간 안내](https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7802&mi=2480): 일반과세자 반기·간이과세자 연 단위. VAT 매출/종합소득세 순소득/법원 인정액 혼합 금지. 이번 실행 세무 산식 변경 없음.

## 6. 다음 r33 IT 및 출시 차단

1. #49+#87 **동일파일 충돌 보존 병합** 및 실제 Node 테스트(순차/동시/페이지 변경/SQL NULL·명시적 0)를 실행. 본 r32는 통합 제품 테스트 **미실행**.
2. P0 `case_calculation_heads` 뒤늦은 구 reference 쓰기 경쟁: 활성 기준정보의 **DB 원자적 기준판본**과 CAS 계약 설계/실제 SQLite→staging D1 검증; 기준정보 동시변경 시 `CALCULATION_VERSION_MISMATCH` 처리. #87 **읽기 stale 표시만**이며 CAS 해결 아님.
3. #84 미승인 청산가치 PV와 #71 SQL replay, #58/#81 D5103, #67/#79 부분월 소득을 **한 판본**으로 결합. 실제 source fact/typed/91입력/42결과/Word, 전체 Node CI, staging D1/R2/Cron, 공식 서식, 법률·세무 전문가 승인 **모두 미인증**.
4. 운영 배포·운영 D1 마이그레이션·전자제출·법원 인가 확정 **미수행**, 제품 인수 0건.
